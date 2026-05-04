import { test as base, request, type APIRequestContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deleteUserByEmail } from '../helpers/db';
import { apiBaseUrl } from '../helpers/config';
import { waitForVerificationLink } from '../helpers/mailpit';

/**
 * Per-role auth fixture: a verified customer with saved storageState.
 *
 * Mirrors the .NET backend contracts (do not drift):
 *   - POST /api/User/register/customer  → RegisterCustomerCommand
 *     (FirstName, LastName, Email, Password, ConfirmPassword)
 *   - POST /api/Auth/login               → LoginCommand (Email, Password)
 *   See backend/RestaurantSystem.Api/Features/User/Commands/RegisterCustomerCommand
 *   and backend/RestaurantSystem.Api/Features/Auth/Commands/LoginCommand.
 *
 * Strategy: docs/E2E-STRATEGY.md §Auth + §Data isolation.
 *
 * Flow per test:
 *   1. Register a fresh customer via the API (unique e2e-prefixed email).
 *   2. Confirm email by hitting the verify-email link the backend sent to
 *      Mailpit — the same path a real user would walk.
 *   3. Log in via the API to get a real JWT exactly as the browser would.
 *   4. Persist auth_token + refresh_token into localStorage via storageState.
 *   5. Tests read `customerUser` to get the credentials and `storageStatePath`
 *      to attach to a `browser.newContext({ storageState })`.
 *   6. Teardown deletes this single user by exact email. Parallel-safe — does
 *      NOT use the prefix-based purge, which would nuke other workers' users.
 */

const E2E_AUTH_DIR = path.resolve(__dirname, '..', '.auth');

export interface CustomerUser {
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

export const test = base.extend<{ customerUser: CustomerUser }>({
  customerUser: async ({ baseURL }, use, testInfo) => {
    const frontendOrigin = baseURL ?? 'http://localhost:3000';

    const email = `e2e-${testInfo.testId}-${Date.now()}@test.local`;
    const password = 'Test123!Pass'; // pragma: allowlist secret -- e2e test fixture, never used outside this file
    const firstName = 'E2E';
    const lastName = 'Customer';

    const ctx = await request.newContext({ baseURL: apiBaseUrl() });
    try {
      await registerCustomer(ctx, { firstName, lastName, email, password });
      // Pull the verify URL from the email Mailpit caught and POST the token
      // straight to /api/Auth/verify-email. We could `page.goto(verifyUrl)`
      // and let the verify page client-side POST, but the fixture has no
      // browser context yet — this is setup time, before the test's `page`.
      const verifyUrl = await waitForVerificationLink(email, { subjectIncludes: 'verif' });
      const tokenMatch = verifyUrl.match(/[?&]token=([^&]+)/);
      const tokenParam = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
      if (!tokenParam) {
        throw new Error(`customerUser: verify URL has no token param: ${verifyUrl}`);
      }
      const verifyResponse = await ctx.post('/api/Auth/verify-email', {
        data: { email, token: tokenParam },
      });
      if (!verifyResponse.ok()) {
        throw new Error(
          `customerUser: verify-email failed ${verifyResponse.status()} ${await verifyResponse.text()}`,
        );
      }
      const auth = await loginCustomer(ctx, { email, password });

      const storageStatePath = await writeStorageState({
        frontendOrigin,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        slug: testInfo.testId,
      });

      const user: CustomerUser = {
        firstName,
        lastName,
        email,
        password,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        storageStatePath,
      };

      await use(user);
    } finally {
      await ctx.dispose();
      try {
        await deleteUserByEmail(email);
      } catch (err) {
        // Don't mask the test result with a teardown failure — but make it visible.
        // eslint-disable-next-line no-console
        console.warn(`[customerUser] teardown failed to delete ${email}:`, err);
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
    throw new Error(
      `register customer failed: ${response.status()} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as ApiResponse<AuthResponseData>;
  if (!body.success) {
    throw new Error(`register customer rejected: ${body.message ?? body.errors?.join(', ')}`);
  }
}

async function loginCustomer(
  ctx: APIRequestContext,
  payload: { email: string; password: string },
): Promise<AuthResponseData> {
  const response = await ctx.post('/api/Auth/login', { data: payload });
  if (!response.ok()) {
    throw new Error(`login failed: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as ApiResponse<AuthResponseData>;
  if (!body.success || !body.data) {
    throw new Error(`login rejected: ${body.message ?? body.errors?.join(', ')}`);
  }
  return body.data;
}

async function writeStorageState(opts: {
  frontendOrigin: string;
  accessToken: string;
  refreshToken: string;
  slug: string;
}): Promise<string> {
  await mkdir(E2E_AUTH_DIR, { recursive: true });
  const file = path.join(E2E_AUTH_DIR, `customer-${opts.slug}.json`);
  const state = {
    cookies: [],
    origins: [
      {
        origin: opts.frontendOrigin,
        localStorage: [
          { name: 'auth_token', value: opts.accessToken },
          { name: 'refresh_token', value: opts.refreshToken },
        ],
      },
    ],
  };
  await writeFile(file, JSON.stringify(state), 'utf8');
  return file;
}

export { expect } from '@playwright/test';
