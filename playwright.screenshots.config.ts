import { defineConfig } from '@playwright/test';

/**
 * Playwright SCREENSHOT-BASELINE configuration — S15 T1 close-out.
 *
 * Separate config (not another project in playwright.config.ts) because
 * `webServer` is config-global: the functional e2e suite runs against the
 * dev server, while this suite runs against a production `next build` +
 * `next start` so pixels match what ships (and the dev-tools overlay never
 * leaks into baselines). Keeping the file separate also guarantees zero
 * behaviour change for the existing `chromium` project.
 *
 * PLATFORM RULE: baselines are LINUX-generated inside the pinned
 * mcr.microsoft.com/playwright image (version = @playwright/test in
 * package-lock.json). Never update snapshots from a macOS host — font
 * rasterisation differs. Use `npm run test:screenshots:docker:update`.
 * The snapshotPathTemplate deliberately omits {platform} for this reason.
 *
 * Docs: e2e/README.md §Screenshot baseline. CI: .github/workflows/screenshots.yml.
 */

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:5221';
const PORT = Number(process.env.SCREENSHOT_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
// Which UI template to build + baseline (S15 T3 DoD — per-template baselines).
// The build bakes it via NEXT_PUBLIC_TEMPLATE; the snapshot path is segmented by
// it so craft PNGs never overwrite classic. Default classic (the existing suite).
const TEMPLATE = process.env.SCREENSHOT_TEMPLATE ?? 'classic';
// See the webServer.command comment: keeping `.next/cache` is only sound when the
// cache is known to belong to the same template, so it is opt-in.
const CLEAN_BUILD_DIR =
  process.env.SCREENSHOT_KEEP_NEXT_CACHE === '1'
    ? 'mkdir -p .next && find .next -mindepth 1 -maxdepth 1 ! -name cache -exec rm -rf {} +'
    : 'rm -rf .next';

export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: '**/*.screen.ts',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      // Sub-0.1% tolerance: absorbs single-pixel anti-aliasing noise without
      // hiding real visual changes. Do NOT raise this to paper over flake —
      // fix the determinism in e2e/screenshots/helpers.ts instead.
      maxDiffPixelRatio: 0.001,
      stylePath: './e2e/screenshots/screenshot.css',
    },
  },
  // No {platform} token — see PLATFORM RULE above. Segmented by TEMPLATE so each
  // template has its own baseline set (S15 T3 DoD).
  snapshotPathTemplate: `{testDir}/__screenshots__/${TEMPLATE}/{projectName}/{arg}{ext}`,

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // screenshots must be deterministic — retries would mask flake
  workers: 2,

  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light', // app themes via html[data-theme], never prefers-color-scheme (ADR-002)
    contextOptions: { reducedMotion: 'reduce' },
    deviceScaleFactor: 1, // keep committed PNGs small + rendering DPR-stable
    trace: 'off',
    video: 'off',
  },

  projects: [
    {
      name: 'screenshots-desktop',
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'screenshots-mobile',
      use: { viewport: { width: 375, height: 812 }, hasTouch: true },
    },
  ],

  webServer: {
    // Wipe the previous build FIRST: NEXT_PUBLIC_TEMPLATE is inlined at build time
    // and the template also swings the @active-template alias (which modules
    // bundle), so a reused .next/cache from a prior template would serve a stale
    // build → wrong baselines. That is why the default is a full `rm -rf .next`.
    //
    // SCREENSHOT_KEEP_NEXT_CACHE=1 keeps `.next/cache` (Next's incremental
    // compiler cache) and wipes everything else. Only set it when the caller can
    // GUARANTEE the cache was produced by the SAME template: CI does, because
    // .github/workflows/screenshots.yml keys actions/cache on ${matrix.template}.
    // Never set it by hand when switching templates locally.
    command: `${CLEAN_BUILD_DIR} && npm run build && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 480_000, // includes a full production `next build`
    env: {
      TZ: 'UTC',
      LANG: 'en_US.UTF-8',
      NEXT_TELEMETRY_DISABLED: '1',
      // Explicit env beats .env.production (which points at live prod URLs).
      NEXT_PUBLIC_API_URL: API_BASE_URL,
      NEXT_PUBLIC_IMAGE_BASE_URL: API_BASE_URL,
      NEXT_PUBLIC_RESTAURANT_NAME: 'RUMI Restaurant',
      // Bake the template under test (default classic). Segments the baselines.
      NEXT_PUBLIC_TEMPLATE: TEMPLATE,
    },
  },
});
