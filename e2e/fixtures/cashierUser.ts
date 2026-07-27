import { test as base, request, type APIRequestContext } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { deleteUserByEmail, promoteE2EUser } from '../helpers/db';
import { apiBaseUrl } from '../helpers/config';
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

export interface CashierUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  storageStatePath: string;
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
  cashierUser: async ({ baseURL }, use, testInfo) => {
    const frontendOrigin = baseURL ?? 'http://localhost:3000';

    const email = `e2e-cashier-${testInfo.testId}-${Date.now()}@test.local`;
    const password = 'Test123!Pass'; // pragma: allowlist secret -- e2e fixture only
    const firstName = 'E2E';
    const lastName = 'Cashier';

    const ctx = await request.newContext({ baseURL: apiBaseUrl() });
    try {
      await registerCustomer(ctx, { firstName, lastName, email, password });
      const promoted = await promoteE2EUser(email, 'Cashier');
      if (promoted !== 1) {
        throw new Error(`cashierUser: promote-to-Cashier rowCount=${promoted}, expected 1`);
      }
      const auth = await loginUser(ctx, { email, password });
      if (auth.role !== 'Cashier') {
        throw new Error(`cashierUser: login returned role=${auth.role}, expected Cashier`);
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
        role: 'cashier',
        slug: testInfo.testId,
      });

      const user: CashierUser = {
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
          console.warn(`[cashierUser] teardown failed to remove storageState ${storageStatePath}:`, err);
        }
      }
    } finally {
      await ctx.dispose();
      try {
        await deleteUserByEmail(email);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[cashierUser] teardown failed to delete ${email}:`, err);
      }
    }
  },
});

async function registerCustomer(
  ctx: APIRequestContext,
  payload: { firstName: string; lastName: string; email: string; password: string },
): Promise<void> {
  const response = await ctx.post('/api/User/register/customer', {
    data: { ...payload, confirmPassword: payload.password },
  });
  if (!response.ok()) {
    throw new Error(`cashierUser: register customer failed ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as ApiResponse<AuthResponseData>;
  if (!body.success) {
    throw new Error(`cashierUser: register rejected: ${body.message ?? body.errors?.join(', ')}`);
  }
}

async function loginUser(
  ctx: APIRequestContext,
  payload: { email: string; password: string },
): Promise<AuthResponseData> {
  const response = await ctx.post('/api/Auth/login', { data: payload });
  if (!response.ok()) {
    throw new Error(`cashierUser: login failed ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as ApiResponse<AuthResponseData>;
  if (!body.success || !body.data) {
    throw new Error(`cashierUser: login rejected: ${body.message ?? body.errors?.join(', ')}`);
  }
  return body.data;
}

export { expect } from '@playwright/test';
