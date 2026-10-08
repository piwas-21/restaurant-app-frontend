import { constants } from 'node:fs';
import { lstat, mkdir, open, unlink, writeFile } from 'node:fs/promises';
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
  userId?: string;
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
  /** Optional owner-only directory for run-scoped P11 credentials. */
  authDirectory?: string;
}

/** Resolve only the private artifact roots created by the cash or Stripe P11 runners. */
export function resolveP11AuthDirectory(environment: Readonly<Record<string, string | undefined>>): string {
  const stripeDirectory = environment.P11_STRIPE_ARTIFACT_DIR;
  if (stripeDirectory !== undefined) {
    const runId = environment.P11_RUN_ID;
    const expected = `/tmp/table-account-p11-stripe-evidence/${runId}/browser`;
    if (
      environment.P11_ARTIFACT_DIR !== undefined ||
      !/^[a-f0-9]{16}$/.test(runId ?? '') ||
      stripeDirectory !== expected
    )
      throw new Error('P11 authentication storage requires its validated private run artifact directory.');
    return path.join(stripeDirectory, 'auth');
  }

  const cashDirectory = environment.P11_ARTIFACT_DIR;
  if (!cashDirectory || !/^\/tmp\/table-account-p11\.[A-Za-z0-9]{6,}\/playwright$/.test(cashDirectory)) {
    throw new Error('P11 authentication storage requires its validated private run artifact directory.');
  }
  return path.join(cashDirectory, 'auth');
}

/** Write a Playwright storageState file and return its path. */
export async function writeAuthStorageState(opts: StorageStateOptions): Promise<string> {
  if (opts.authDirectory) return writePrivateAuthStorageState(opts, opts.authDirectory);

  await mkdir(E2E_AUTH_DIR, { recursive: true });
  const file = path.join(E2E_AUTH_DIR, `${opts.role}-${opts.slug}.json`);
  await writeFile(file, JSON.stringify(buildAuthStorageState(opts)), 'utf8');
  return file;
}

async function writePrivateAuthStorageState(opts: StorageStateOptions, directory: string): Promise<string> {
  const userId = currentUserId();
  await assertPrivateDirectory(path.dirname(directory));
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (!isAlreadyExists(error)) throw new Error('P11 authentication storage directory could not be created.');
  }
  await assertPrivateDirectory(directory);

  const filename = `${opts.role}-${opts.slug}.json`;
  if (!/^[A-Za-z0-9_-]+\.json$/.test(filename)) {
    throw new Error('P11 authentication storage filename is invalid.');
  }
  const file = path.join(directory, filename);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  let handle;
  let created = false;
  try {
    handle = await open(file, flags, 0o600);
    created = true;
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== userId || (stat.mode & 0o777) !== 0o600) {
      throw new Error('P11 authentication storage file is not a private regular file.');
    }
    const state = buildAuthStorageState(opts);
    await handle.writeFile(JSON.stringify(state), 'utf8');
    await handle.sync();
  } catch (error) {
    await handle?.close().catch(() => undefined);
    handle = undefined;
    if (created) await unlink(file).catch(() => undefined);
    throw error;
  } finally {
    await handle?.close();
  }
  await assertPrivateDirectory(directory);
  return file;
}

function buildAuthStorageState(opts: StorageStateOptions) {
  return {
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
}

async function assertPrivateDirectory(directory: string): Promise<void> {
  let handle;
  try {
    const linked = await lstat(directory);
    if (!linked.isDirectory() || linked.isSymbolicLink()) throw new Error('not a directory');
    handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (
      !opened.isDirectory() ||
      opened.uid !== currentUserId() ||
      (opened.mode & 0o777) !== 0o700 ||
      opened.dev !== linked.dev ||
      opened.ino !== linked.ino
    )
      throw new Error('directory identity or permissions changed');
  } catch {
    throw new Error('P11 authentication storage requires owner-only directories.');
  } finally {
    await handle?.close();
  }
}

function currentUserId(): number {
  const userId = process.getuid?.();
  if (userId === undefined) throw new Error('P11 authentication storage requires a local user identity.');
  return userId;
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}
