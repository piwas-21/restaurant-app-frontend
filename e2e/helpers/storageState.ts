import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Shared writer for the browser state a signed-in user would actually have.
 *
 * All THREE localStorage keys are required. `AuthContext.validateSession`
 * (src/components/AuthContext.tsx) bootstraps from `user` + `auth_token` + `refresh_token` and does
 * nothing at all when any one of them is missing — it does not fall back to decoding the JWT. A
 * context carrying only the two tokens is therefore ANONYMOUS: the app renders the guest experience,
 * and role-guarded layouts redirect (the cashier layout pushes to `/auth/login`). That redirect
 * lands a few seconds after first paint, which is why a spec asserting immediately could stay green
 * while anything slower failed on the sign-in page.
 *
 * Until BUGS-IMPROVEMENTS-PLAN D1 that push went to `/login`, which has never been a route, so the
 * symptom was Next's bare 404 rather than a login form. If you are reading an old failure, that is
 * what it was.
 *
 * One writer for every role fixture so the three-key contract is stated once.
 */

const E2E_AUTH_DIR = path.resolve(__dirname, '..', '.auth');

/** Exactly the `User` shape `AuthContext.login` persists. */
export interface StoredUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accessToken: string;
}

export interface StorageStateOptions {
  frontendOrigin: string;
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
  /** Role name used as the filename prefix, e.g. `cashier` → `e2e/.auth/cashier-<slug>.json`. */
  role: string;
  /** Per-test discriminator; `testInfo.testId` keeps parallel workers off each other's files. */
  slug: string;
}

/** Write a Playwright storageState file and return its path. */
export async function writeAuthStorageState(opts: StorageStateOptions): Promise<string> {
  await mkdir(E2E_AUTH_DIR, { recursive: true });
  const file = path.join(E2E_AUTH_DIR, `${opts.role}-${opts.slug}.json`);
  const state = {
    cookies: [],
    origins: [
      {
        origin: opts.frontendOrigin,
        localStorage: [
          { name: 'auth_token', value: opts.accessToken },
          { name: 'refresh_token', value: opts.refreshToken },
          { name: 'user', value: JSON.stringify(opts.user) },
        ],
      },
    ],
  };
  await writeFile(file, JSON.stringify(state), 'utf8');
  return file;
}
