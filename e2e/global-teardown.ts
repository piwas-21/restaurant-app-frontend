import { closeDbPool } from './helpers/db';

/**
 * Playwright globalTeardown — release the Postgres pool so Node exits cleanly.
 *
 * Per-test users are deleted in their own afterEach (or fixture teardown);
 * we deliberately do NOT call `purgeE2EUsers` here, which would race with
 * any concurrent shard / re-run. Manual prefix-based cleanup is documented
 * in e2e/helpers/db.ts.
 */
export default async function globalTeardown(): Promise<void> {
  await closeDbPool();
}
