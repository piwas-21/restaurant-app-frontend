import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * Strategy: docs/E2E-STRATEGY.md
 * Layout:   e2e/{tests,pages,fixtures,helpers,seed}
 */

/**
 * Which dev-server command this checkout can actually start (#623).
 *
 * In a git worktree, node_modules is a SYMLINK to the primary clone's, and Turbopack
 * refuses it outright — `TurbopackInternalError: Symlink node_modules is invalid, it
 * points out of the filesystem root` — so the webServer died before a single test ran,
 * which read as "the suite is broken" rather than "worktrees exist". webpack (`next dev`
 * without --turbopack) follows the symlink happily. Detect the symlinked case by
 * resolving real paths and swap to the webpack dev script; the primary clone and CI
 * (real node_modules) keep running `npm run dev` with Turbopack, so what E2E compiles
 * with only ever differs in the worktree case, where the alternative was nothing.
 */
function devServerCommand(): string {
  const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
  try {
    if (fs.lstatSync(nodeModulesPath).isSymbolicLink()) {
      return 'npm run dev:webpack';
    }
  } catch {
    // No node_modules at all — run the default command and let npm say so.
  }
  return 'npm run dev';
}
export default defineConfig({
  testDir: './e2e/tests',
  testMatch: '**/*.e2e.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Skip the local dev server when the run targets a DEPLOYED environment
  // (E2E_REMOTE=1 with E2E_BASE_URL=https://staging.fooderist.com, say). Without
  // this, pointing baseURL at staging still boots `npm run dev` and waits on
  // localhost:3000 for two minutes before running a single test.
  webServer: process.env.E2E_REMOTE
    ? undefined
    : {
        command: devServerCommand(),
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 120_000,
        env: {
          TZ: 'UTC',
          LANG: 'en_US.UTF-8',
          // Pin the dev server's backend URL to E2E_API_BASE_URL so browser-side
          // fetches don't fall through to whatever .env.local has (e.g. a stale
          // staging URL). Fixture-level request.* calls already use this value.
          NEXT_PUBLIC_API_URL: process.env.E2E_API_BASE_URL ?? 'http://localhost:5221',
        },
      },
});
