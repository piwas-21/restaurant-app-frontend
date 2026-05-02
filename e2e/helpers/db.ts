import { Pool } from 'pg';

/**
 * Direct Postgres helper for E2E test cleanup.
 *
 * Connection comes from the E2E_DATABASE_URL env var, which scripts/dev-e2e.sh
 * exports before launching Playwright. Hard-fails if unset — production is
 * live, so fail-loud beats a silent fallback that points at the wrong DB.
 *
 * Email verification is driven via Mailpit + the real /verify-email UI link
 * (see helpers/mailpit.ts) — there is no DB shortcut for that anymore. This
 * helper is purely about removing test users and their dependents.
 *
 * Use:
 *   - deleteUserByEmail(email)   : per-test teardown (parallel-safe)
 *   - purgeE2EUsers()            : globalTeardown only — DESTRUCTIVE across workers
 */
const E2E_USER_PREFIX = 'e2e-';

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.E2E_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'E2E_DATABASE_URL is not set. Run tests via scripts/dev-e2e.sh, ' +
          'or export E2E_DATABASE_URL=postgres://user:pass@host:port/db before invoking Playwright.', // pragma: allowlist secret
      );
    }
    pool = new Pool({ connectionString, max: 4 });
  }
  return pool;
}

// TODO(task-4): wire `closeDbPool` into Playwright globalTeardown so the
// process exits cleanly instead of relying on the pool's idle-timeout.
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Delete a single E2E user by exact email. Parallel-worker safe — only
 * touches the one row, not the whole prefix.
 *
 * Asserts the email starts with the e2e prefix to make accidental misuse
 * against a real account impossible.
 *
 * Schema note: ApplicationUser : IdentityUser is mapped to "Users"
 * (PascalCase, quoted) with snake_case columns (unquoted) per the project's
 * EF naming convention. Don't "fix" to AspNetUsers — that table doesn't exist.
 *
 * Returns the number of rows deleted (0 or 1). Tests SHOULD treat 0 as
 * non-fatal (the user may have been cleaned up already).
 */
export async function deleteUserByEmail(email: string): Promise<number> {
  assertE2EEmail(email);
  const pool = getPool();

  // FK constraints to "Users" are RESTRICT, so dependents must go first.
  // Resolve the id once; absent == already cleaned (return 0, idempotent).
  const idRes = await pool.query<{ id: string }>(
    'SELECT id FROM "Users" WHERE normalized_email = $1',
    [email.toUpperCase()],
  );
  const userId = idRes.rows[0]?.id;
  if (!userId) return 0;

  // Cascade the dependents that the auth flow creates today (Baskets +
  // BasketItems via the login basket-merge handler). Grow this list as new
  // e2e tests touch more user-owned tables (orders, reservations, addresses…).
  await pool.query(
    'DELETE FROM "BasketItems" WHERE basket_id IN (SELECT id FROM "Baskets" WHERE user_id = $1)',
    [userId],
  );
  await pool.query('DELETE FROM "Baskets" WHERE user_id = $1', [userId]);

  const res = await pool.query('DELETE FROM "Users" WHERE id = $1', [userId]);
  return res.rowCount ?? 0;
}

/**
 * Delete every E2E user by prefix.
 *
 * DESTRUCTIVE under parallel execution — will nuke in-flight users from
 * other workers. Use ONLY in globalTeardown (or a clean-slate manual step),
 * never in afterEach. Per-test cleanup must use `deleteUserByEmail`.
 *
 * Filters by normalized prefix `E2E-` so unrelated rows are never touched.
 */
export async function purgeE2EUsers(): Promise<number> {
  const result = await getPool().query(
    'DELETE FROM "Users" WHERE normalized_email LIKE $1',
    [`${E2E_USER_PREFIX.toUpperCase()}%`],
  );
  return result.rowCount ?? 0;
}

function assertE2EEmail(email: string): void {
  const lowered = email.toLowerCase();
  const prefix = E2E_USER_PREFIX.toLowerCase();
  if (!lowered.startsWith(prefix)) {
    throw new Error(
      `Refusing to mutate non-E2E account: "${email}" must start with "${E2E_USER_PREFIX}"`,
    );
  }
}
