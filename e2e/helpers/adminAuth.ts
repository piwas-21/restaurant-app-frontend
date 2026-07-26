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

const AUTH_DIR = path.resolve(process.cwd(), 'e2e/.auth');

/** Which credential key belongs to which deployed host. */
export function credKeyForBaseUrl(baseUrl: string): string {
  if (baseUrl.includes('demo.sofrapiwas.com')) return 'ADMIN_DEMO_CRAFT';
  if (baseUrl.includes('staging.fooderist.com')) return 'ADMIN_STAGING_CLASSIC';
  return 'ADMIN';
}

/**
 * Read a credential out of `.env.local`.
 *
 * ⚠️ Parse with the regex, never `split(':')`. The value is an object literal —
 * `ADMIN_DEMO_CRAFT={email: someone@example.com, password: …}` — so it contains THREE colons and a
 * naive split yields an email of `" …@…, password"`. The API then answers a perfectly honest 401,
 * which reads exactly like a stale credential. That cost a real detour.
 */
export function readCreds(key: string): AdminCreds | null {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return null;

  const line = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return null;

  const raw = line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
  const match = /\{?\s*email\s*:\s*([^,]+?)\s*,\s*password\s*:\s*(.+?)\s*\}?$/.exec(raw);
  return match ? { email: match[1], password: match[2] } : null;
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
  if (!creds) return { token: null, reason: `no ${credKey} credential in .env.local for this environment` };

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

  const body = (await res.json()) as { data?: { accessToken?: string } };
  const token = body?.data?.accessToken ?? null;
  if (!token) return { token: null, reason: 'login succeeded but returned no accessToken' };

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ token }), 'utf8');
  return { token };
}
