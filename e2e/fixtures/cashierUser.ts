import { test as base, request, type APIRequestContext, type TestInfo } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { deleteUserByEmail, promoteE2EUser } from '../helpers/db';
import { apiBaseUrl, frontendBaseUrl } from '../helpers/config';
import { writeAuthStorageState } from '../helpers/storageState';

/**
 * Per-role auth fixture: a cashier with saved storageState.
 *
 * Backend doesn't expose an unauthenticated "register staff" endpoint —
 * `/api/User/register/staff` is admin-only by design. To avoid having an
 * always-on E2E admin account (and the secret-management tax that comes
 * with it), we register through the public customer endpoint and then
 * promote the row directly in the test database via `promoteE2EUser`,
 * which also marks the email confirmed so we skip the Mailpit round-trip.
 *
 * Strategy: docs/E2E-STRATEGY.md §Auth + §Data isolation.
 *
 * Mirrors the .NET backend contracts (do not drift):
 *   - POST /api/User/register/customer → RegisterCustomerCommand
 *     (FirstName, LastName, Email, Password, ConfirmPassword)
 *   - POST /api/Auth/login              → LoginCommand (Email, Password)
 *
 * Flow per test:
 *   1. Register a fresh customer via the public API.
 *   2. UPDATE Users.role = Cashier and email_confirmed = TRUE in the test DB
 *      (parallel-safe — single-row update by exact email).
 *   3. Log in via the API. The returned JWT carries the Cashier role claim.
 *   4. Persist the signed-in browser state via the shared storageState writer.
 *   5. Tests read `cashierUser` and attach `storageStatePath` to a fresh
 *      browser context.
 *   6. Teardown deletes the user by exact email.
 */

export interface StaffUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  storageStatePath: string;
}

export type CashierUser = StaffUser;

interface StaffFixtureConfig {
  role: 'Cashier' | 'Server';
  storageRole: 'cashier' | 'server';
  fixtureName: 'cashierUser' | 'serverUser';
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

interface AuthResponseData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accessToken: string;
  refreshToken: string;
  expiration: string;
}

export const test = base.extend<{ cashierUser: CashierUser }>({
  cashierUser: async ({ baseURL }, use, testInfo) =>
    usePromotedStaffUser(baseURL, use, testInfo, {
      role: 'Cashier',
      storageRole: 'cashier',
      fixtureName: 'cashierUser',
    }),
});

export async function usePromotedStaffUser(
  baseURL: string | undefined,
  use: (user: StaffUser) => Promise<void>,
  testInfo: TestInfo,
  config: StaffFixtureConfig,
): Promise<void> {
  const frontendOrigin = baseURL ?? frontendBaseUrl();
  const email = `e2e-${config.storageRole}-${testInfo.testId}-${Date.now()}@test.local`;
  const password = 'Test123!Pass'; // pragma: allowlist secret -- e2e fixture only
  const firstName = 'E2E';
  const lastName = config.role;

  const ctx = await request.newContext({ baseURL: apiBaseUrl() });
  try {
    await registerCustomer(ctx, { firstName, lastName, email, password }, config.fixtureName);
    const promoted = await promoteE2EUser(email, config.role);
    if (promoted !== 1) {
      throw new Error(`${config.fixtureName}: promote-to-${config.role} rowCount=${promoted}, expected 1`);
    }
    const auth = await loginUser(ctx, { email, password }, config.fixtureName);
    if (auth.role !== config.role) {
      throw new Error(`${config.fixtureName}: login returned role=${auth.role}, expected ${config.role}`);
    }

    const storageStatePath = await writeAuthStorageState({
      frontendOrigin,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: {
        firstName: auth.firstName,
        lastName: auth.lastName,
        email: auth.email,
        role: auth.role,
        accessToken: auth.accessToken,
      },
      role: config.storageRole,
      slug: testInfo.testId,
    });

    const user: StaffUser = {
      firstName,
      lastName,
      email,
      password,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      storageStatePath,
    };

    try {
      await use(user);
    } finally {
      // Drop the per-test storageState file so e2e/.auth/ doesn't
      // accumulate stale credentials between runs. `force: true`
      // means missing-file isn't an error if a prior failure
      // already removed it.
      try {
        await rm(storageStatePath, { force: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[${config.fixtureName}] teardown failed to remove storageState ${storageStatePath}:`, err);
      }
    }
  } finally {
    await ctx.dispose();
    try {
      await deleteUserByEmail(email);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[${config.fixtureName}] teardown failed to delete generated user for ${testInfo.testId}:`, err);
    }
  }
}

async function registerCustomer(
  ctx: APIRequestContext,
  payload: { firstName: string; lastName: string; email: string; password: string },
  fixtureName: string,
): Promise<void> {
  const response = await ctx.post('/api/User/register/customer', {
    data: { ...payload, confirmPassword: payload.password },
  });
  if (!response.ok()) {
    throw new Error(`${fixtureName}: register customer failed ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as ApiResponse<AuthResponseData>;
  if (!body.success) {
    throw new Error(`${fixtureName}: register rejected: ${body.message ?? body.errors?.join(', ')}`);
  }
}

async function loginUser(
  ctx: APIRequestContext,
  payload: { email: string; password: string },
  fixtureName: string,
): Promise<AuthResponseData> {
  const response = await ctx.post('/api/Auth/login', { data: payload });
  if (!response.ok()) {
    throw new Error(`${fixtureName}: login failed ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as ApiResponse<AuthResponseData>;
  if (!body.success || !body.data) {
    throw new Error(`${fixtureName}: login rejected: ${body.message ?? body.errors?.join(', ')}`);
  }
  return body.data;
}

export { expect } from '@playwright/test';
