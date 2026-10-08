import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig, devices } from '@playwright/test';

const require = createRequire(path.resolve('e2e/p11-stripe/playwright.config.ts'));
const { validateStripeBrowserEnvironment } = require('../../scripts/e2e-p11-stripe-profile.cjs') as {
  validateStripeBrowserEnvironment: (env: NodeJS.ProcessEnv) => { uiPort: string };
};
const identity = validateStripeBrowserEnvironment(process.env);
const baseURL = process.env.E2E_BASE_URL;
const apiURL = process.env.E2E_API_BASE_URL;
const artifactDir = process.env.P11_STRIPE_ARTIFACT_DIR;
const runId = process.env.P11_RUN_ID;
const evidenceRoot = process.env.P11_STRIPE_EVIDENCE_ROOT;
if (!baseURL || !apiURL || !runId || !evidenceRoot || artifactDir !== path.join(evidenceRoot, runId, 'browser'))
  throw new Error('Stripe browser acceptance requires its private run-owned artifact directory.');

const nextEntrypoint = path.resolve('node_modules/next/dist/bin/next');
export default defineConfig({
  testDir: path.resolve('e2e/p11-stripe/tests'),
  testMatch: '**/*.e2e.ts',
  outputDir: path.join(artifactDir, 'test-results'),
  timeout: 15 * 60 * 1000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: path.join(artifactDir, 'results.json') }]],
  use: { baseURL, trace: 'off', screenshot: 'off', video: 'off', headless: true },
  projects: [{ name: 'p11-stripe-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${JSON.stringify(process.execPath)} ${JSON.stringify(nextEntrypoint)} dev --hostname 127.0.0.1 --port ${identity.uiPort}`,
    cwd: path.resolve('.'),
    url: `${baseURL}/en/menu`,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 180_000,
    env: {
      TZ: 'UTC',
      PORT: identity.uiPort,
      NEXT_PUBLIC_API_URL: apiURL,
      E2E_API_BASE_URL: apiURL,
      TENANT_FEATURES_REQUEST_TIMEOUT_MS: '3000',
    },
  },
});
