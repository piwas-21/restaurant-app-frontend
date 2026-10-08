import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig, devices } from '@playwright/test';

const require = createRequire(path.resolve('e2e/p11/playwright.config.ts'));
const { validateP11LocalIdentity, validateP11ArtifactDirectory } = require('../../scripts/e2e-p11-target.cjs') as {
  validateP11LocalIdentity: (env?: NodeJS.ProcessEnv) => {
    runId: string;
    databaseName: string;
    databasePort: string;
    apiPort: string;
    uiPort: string;
  };
  validateP11ArtifactDirectory: (artifactDir: string, stateDir: string, runId: string) => string;
};

const identity = validateP11LocalIdentity();
const baseURL = process.env.E2E_BASE_URL;
const apiURL = process.env.E2E_API_BASE_URL;
const artifactDir = validateP11ArtifactDirectory(
  process.env.P11_ARTIFACT_DIR ?? '',
  process.env.P11_RUN_STATE_DIR ?? '',
  identity.runId,
);

if (!baseURL || !apiURL) {
  throw new Error('P11 Playwright must be launched by the isolated local runner.');
}

const outputDir = path.join(artifactDir, 'test-results');
const reportDir = path.join(artifactDir, 'report');
const nextEntrypoint = path.resolve('node_modules/next/dist/bin/next');

export default defineConfig({
  testDir: path.resolve('e2e/p11/tests'),
  testMatch: '**/*.e2e.ts',
  outputDir,
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: reportDir, open: 'never' }],
    ['json', { outputFile: path.join(artifactDir, 'results.json') }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [{ name: 'p11-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${JSON.stringify(process.execPath)} ${JSON.stringify(nextEntrypoint)} dev --hostname 127.0.0.1 --port ${identity.uiPort}`,
    // Playwright otherwise starts from this config's directory. Next selects tenant templates
    // relative to the repository root, which the isolated runner sets as process.cwd().
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
