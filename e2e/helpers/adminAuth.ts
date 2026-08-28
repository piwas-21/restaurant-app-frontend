import type { APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Admin bearer token for the environment under test, fetched AT MOST ONCE per run and cached
 * across runs.
 *
 * Why the ceremony: deployed environments allow **5 logins per 15 minutes, partitioned by client
 * IP** (`RateLimiterSettings.AuthPermitLimit`; the Development profile relaxes it to 1000, which is
 * what CI's local backend uses). Playwright runs `beforeAll` **per worker**, so a suite that logs in
 * there spends 4–5 permits per run and 429s itself within three runs. That is not a limit worth
 * relaxing — staging's value is being production-like, and this exact subsystem caused a prod
 * incident (backend #209/#214, refresh-token limit conflated with login → real users locked out).
 * The strategy doc already prescribes the fix: bake the token once, reuse it.
 *
 * So: a file cache under `e2e/.auth/` (gitignored), keyed by credential, holding the JWT and its own
 * `exp`. A whole afternoon of iterating costs one permit.
 */
export interface AdminCreds {
  email: string;
  password: string;
}

export interface TokenResult {
  token: string | null;
  /** Why there is no token — rendered straight into the `test.skip()` reason. */
  reason?: string;
}

/**
 * Everything `writeAuthStorageState` needs to hand the BROWSER a signed-in session.
 *
 * `adminToken` returns only the bearer, which is all an API-level suite needs. A UI-level suite
 * needs all three localStorage keys — `AuthContext.validateSession` bootstraps from
 * `user` + `auth_token` + `refresh_token` and does nothing at all if any one is missing, rendering
 * the ANONYMOUS experience while looking signed in for a moment (see helpers/storageState.ts).
 *
 * ⚠️ A session is NEVER cached, and the reason is not caution — it is that a cached one is
 * actively wrong. `AuthContext.validateSession` bootstraps by calling `refreshToken()`, and
 * `RefreshTokenCommand` ROTATES: it replaces the stored hash on every use. So the browser
 * consumes the refresh token on page load, and replaying it on the next run is a genuine
 * "Invalid token" — at which point AuthContext clears all three keys and the app renders
 * anonymous, role-guarded routes redirect, and the failure looks exactly like a stale
 * credential rather than a spent one. That cost a real detour: the first run passed, every
 * run after it failed with the tenant's PUBLIC home page in the screenshot.
 *
 * So a UI suite spends ONE login permit per run. That is the honest price; the bearer cache
 * still covers every API-level suite, so a run costs one permit and not five.
 */
export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface SessionResult {
  session: AdminSession | null;
  reason?: string;
}

const AUTH_DIR = path.resolve(process.cwd(), 'e2e/.auth');

/** Which credential key belongs to which deployed host. */
export function credKeyForBaseUrl(baseUrl: string): string {
  if (baseUrl.includes('demo.sofrapiwas.com')) return 'ADMIN_DEMO_CRAFT';
  if (baseUrl.includes('staging.fooderist.com')) return 'ADMIN_STAGING_CLASSIC';
  return 'ADMIN';
}

/**
 * Parse one `{email: …, password: …}` object literal.
 *
 * ⚠️ Parse with the regex, never `split(':')`. The value is an object literal —
 * `ADMIN_DEMO_CRAFT={email: someone@example.com, password: …}` — so it contains THREE colons and a
 * naive split yields an email of `" …@…, password"`. The API then answers a perfectly honest 401,
 * which reads exactly like a stale credential. That cost a real detour.
 */
function parseCredValue(value: string): AdminCreds | null {
  const raw = value.trim().replace(/^["']|["']$/g, '');
  // Two simple patterns rather than one combined expression, and neither puts `\s*` NEXT TO a
  // greedy class that can also match whitespace — `\s*(.+)` is ambiguous (`.` matches spaces too),
  // so the engine can split the boundary many ways and backtracks super-linearly when the match
  // fails (Sonar S8786). Trimming afterwards costs nothing and keeps each pattern unambiguous:
  // `\s*` is only ever followed by the literal `:`, and each capture starts right after it.
  const body = raw.replace(/^\{/, '').replace(/\}$/, '');
  const email = /email\s*:([^,]*)/.exec(body)?.[1]?.trim();
  const password = /password\s*:(.*)$/.exec(body)?.[1]?.trim();
  return email && password ? { email, password } : null;
}

/** The `.env.local` half — a developer's own credential, on disk, gitignored. */
function credsFromEnvFile(key: string): AdminCreds | null {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return null;

  const line = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return null;

  return parseCredValue(line.slice(line.indexOf('=') + 1));
}

/**
 * The environment half (issue #585).
 *
 * CI has no `.env.local` and must not grow one — writing a dotfile with a credential into the
 * workspace is exactly the thing gitleaks exists to stop. Two accepted shapes:
 *
 *   ADMIN='{email: …, password: …}'   the same literal `.env.local` uses, for symmetry
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=…    a plain pair, which is what a workflow `env:` block wants
 *
 * The pair wins when both are set: it is the unambiguous one, and a half-filled object literal
 * parses to `null` rather than to something wrong.
 */
function credsFromProcessEnv(key: string): AdminCreds | null {
  const email = process.env[`${key}_EMAIL`]?.trim();
  const password = process.env[`${key}_PASSWORD`]?.trim();
  if (email && password) return { email, password };

  const literal = process.env[key];
  return literal ? parseCredValue(literal) : null;
}

/**
 * A credential for `key`, from `.env.local` first and the environment second.
 *
 * File first so a developer who has both keeps the value they can see and edit; CI only ever has
 * the environment, so the order never matters there.
 */
export function readCreds(key: string): AdminCreds | null {
  return credsFromEnvFile(key) ?? credsFromProcessEnv(key);
}

/**
 * Is the run pointed at the ephemeral local/CI stack rather than a deployed tenant?
 *
 * Anything that is not an explicit remote host counts as local, including an unset `E2E_BASE_URL`
 * — Playwright's own default baseURL is `http://localhost:3000`.
 */
export function isLocalStack(baseUrl: string): boolean {
  const url = baseUrl || process.env.E2E_BASE_URL || 'http://localhost:3000';
  return /localhost|127\.0\.0\.1|\[::1\]/.test(url);
}

/**
 * The hole issue #585 closed, wired shut.
 *
 * Before this, a missing credential made every admin suite `test.skip()` — and a skipped test is a
 * passing check, so CI reported green on a stack where the admin journey was never attempted. On
 * the CI stack the credential is seeded by the workflow and is therefore NOT optional: its absence
 * is a broken gate, not an environmental fact, so it THROWS and the job goes red.
 *
 * Deliberately scoped to `CI` + a local base URL. A developer running the public suite without a
 * credential still gets an honest skip, and every deployed-host reason (rate limit, remote-only)
 * stays a skip everywhere — those are environmental and always were.
 */
function assertCredentialConfigured(key: string, baseUrl: string): void {
  if (!process.env.CI || !isLocalStack(baseUrl)) return;
  throw new Error(
    `No ${key} credential on the CI stack. The Playwright job seeds an admin through the backend ` +
      `(SeedSettings__AdminEmail/__AdminPassword) and passes it here as ${key}_EMAIL/${key}_PASSWORD. ` +
      'Both halves must be present or every admin spec skips and CI reports green on nothing — ' +
      'see issue #585. This is a FAILURE on purpose; do not turn it back into a skip.',
  );
}

/** Seconds-since-epoch expiry from a JWT, or null when it cannot be read. */
function jwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

function cachePath(credKey: string, apiBase: string): string {
  // Host-scoped: the staging and demo tokens are different principals on different backends.
  const host = apiBase.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_');
  return path.join(AUTH_DIR, `${credKey}.${host}.json`);
}

function readCachedToken(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  try {
    const { token } = JSON.parse(fs.readFileSync(file, 'utf8')) as { token?: string };
    if (!token) return null;
    const exp = jwtExpiry(token);
    // 60s of slack so a token cannot expire mid-suite.
    if (exp !== null && exp * 1000 <= Date.now() + 60_000) return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * The cached token, or one fresh login. Never more than one login per call, and none at all when a
 * valid token is already on disk.
 *
 * Returns a REASON rather than throwing, so a suite skips with an explanation — "rate limited",
 * "no credential configured" and "rejected" are very different situations and a bare failure hides
 * which one you are in.
 */
export async function adminToken(request: APIRequestContext, apiBase: string, credKey: string): Promise<TokenResult> {
  const file = cachePath(credKey, apiBase);
  const cached = readCachedToken(file);
  if (cached) return { token: cached };

  const creds = readCreds(credKey);
  if (!creds) {
    // Red, not skipped, on the CI stack — see assertCredentialConfigured (#585).
    assertCredentialConfigured(credKey, apiBase);
    return { token: null, reason: `no ${credKey} credential in .env.local or the environment` };
  }

  const res = await request.post(`${apiBase}/api/Auth/login`, { data: creds });

  if (res.status() === 429) {
    return {
      token: null,
      reason:
        'auth rate limit hit (5 logins / 15 min per IP). The cached token under e2e/.auth/ is the ' +
        'normal path — this only happens after several cold runs. Wait out the window; do NOT relax ' +
        'the limiter, staging mirrors prod here on purpose.',
    };
  }
  if (!res.ok()) return { token: null, reason: `login rejected (HTTP ${res.status()}) for ${credKey}` };

  const body = (await res.json()) as { data?: LoginPayload };
  const token = body?.data?.accessToken ?? null;
  if (!token) return { token: null, reason: 'login succeeded but returned no accessToken' };

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  // ONLY the bearer is cached. A bearer is replayable until `exp`; a refresh token is not
  // (see AdminSession) — caching one hands the next run a token the last run already spent.
  fs.writeFileSync(file, JSON.stringify({ token }), 'utf8');
  return { token };
}

/** The `AuthResponse` shape (backend Features/Auth/Dtos/AuthResponse.cs). */
interface LoginPayload {
  accessToken?: string;
  refreshToken?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

function sessionFrom(data: LoginPayload | undefined): AdminSession | null {
  if (!data?.accessToken || !data?.refreshToken) return null;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    firstName: data.firstName ?? 'Admin',
    lastName: data.lastName ?? 'User',
    email: data.email ?? '',
    // The backend serialises UserRole as a string ("Admin"); the app stores whatever it was given.
    role: data.role ?? 'Admin',
  };
}

/**
 * A full signed-in session for the browser. Always a FRESH login — never cached, because the
 * refresh token rotates and the browser spends it on bootstrap (see {@link AdminSession}).
 *
 * Same reason-rather-than-throw contract as {@link adminToken}, so a suite skips with an
 * explanation instead of failing opaquely.
 */
export async function adminSession(
  request: APIRequestContext,
  apiBase: string,
  credKey: string,
): Promise<SessionResult> {
  const creds = readCreds(credKey);
  if (!creds) {
    // Red, not skipped, on the CI stack — see assertCredentialConfigured (#585).
    assertCredentialConfigured(credKey, apiBase);
    return { session: null, reason: `no ${credKey} credential in .env.local or the environment` };
  }

  const res = await request.post(`${apiBase}/api/Auth/login`, { data: creds });
  if (res.status() === 429) {
    return {
      session: null,
      reason:
        'auth rate limit hit (5 logins / 15 min per IP). A UI suite costs one permit per run ' +
        'because the browser spends the refresh token on bootstrap. Wait out the window; do NOT ' +
        'relax the limiter, staging mirrors prod here on purpose.',
    };
  }
  if (!res.ok()) return { session: null, reason: `login rejected (HTTP ${res.status()}) for ${credKey}` };

  const body = (await res.json()) as { data?: LoginPayload };
  const session = sessionFrom(body?.data);
  return session
    ? { session }
    : { session: null, reason: `login for ${credKey} returned no refreshToken — cannot build a browser session` };
}
