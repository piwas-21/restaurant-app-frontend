#!/usr/bin/env node
// First-Load-JS bundle-size gate (DEV-PHASES-PLAN W2, D2 performance).
// Catches JS-payload regressions on every route: a route whose gzipped
// First Load JS grows more than the baseline's tolerance past the committed
// baseline fails CI (acceptance criterion "bundle-size jump >10%"). Reads
// the build output, needs no running server and no backend, adds no deps.
//
// Metric: for each route, sum the gzipped bytes of every JS chunk the App
// Router loads for its first paint (from .next/app-build-manifest.json).
// This reproduces Next's printed "First Load JS" within ~2% and is stable
// across machines because SWC minification + zlib are both deterministic.
//
// The baseline is STICKY: a passing PR does not move it, so N small PRs each
// +9% still trip the gate on the second one (cumulative drift is measured
// against the same committed reference). Raising the baseline is a deliberate,
// reviewable act — run with --update and commit the diff.
//
// Usage:
//   node scripts/check-bundle-size.mjs           # check current build vs baseline (exit 1 on regression)
//   node scripts/check-bundle-size.mjs --update   # rewrite the baseline from the current build
//
// Requires a prior `npm run build` (reads .next/). Exit 0 = within budget.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const NEXT_DIR = new URL('../.next/', import.meta.url);
const MANIFEST = new URL('app-build-manifest.json', NEXT_DIR).pathname;
const BASELINE = new URL('./bundle-size-baseline.json', import.meta.url).pathname;
const DEFAULT_TOLERANCE = 0.1; // 10% headroom; overridable via the baseline's `tolerancePct`

// Convert an app-build-manifest page key to the user-facing route path.
// '/page' -> '/', '/menu/page' -> '/menu', '/(auth)/login/page' -> '/login'.
// Layouts and API route handlers ('/route') carry no first-load page bundle.
function toRoute(key) {
  if (key === '/layout' || !key.endsWith('/page')) return null;
  const route = key.replace(/\/page$/, '').replace(/\/\([^)]+\)/g, '');
  return route === '' ? '/' : route;
}

// Gzipped size (kB, 1 decimal) of the JS chunks a route loads for first paint.
function firstLoadJsKb(files) {
  let bytes = 0;
  for (const file of files) {
    if (!file.endsWith('.js')) continue; // CSS is not part of Next's First Load JS figure
    bytes += gzipSync(readFileSync(new URL(file, NEXT_DIR))).length;
  }
  return Math.round((bytes / 1024) * 10) / 10;
}

if (!existsSync(MANIFEST)) {
  console.error(`✗ ${MANIFEST} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const current = {};
for (const [key, files] of Object.entries(manifest.pages)) {
  const route = toRoute(key);
  if (route) current[route] = firstLoadJsKb(files);
}

const update = process.argv.includes('--update');
if (update) {
  const sorted = Object.fromEntries(
    Object.keys(current)
      .sort((a, b) => a.localeCompare(b))
      .map((r) => [r, current[r]]),
  );
  // Preserve a hand-tuned tolerance if the baseline already sets one.
  const prior = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const tolerancePct = typeof prior.tolerancePct === 'number' ? prior.tolerancePct : DEFAULT_TOLERANCE * 100;
  const payload = {
    _comment:
      'First Load JS (gzipped kB) per route — DEV-PHASES W2 D2 budget. Regenerate with `node scripts/check-bundle-size.mjs --update` after an intended change; a route may not grow past its value here by more than `tolerancePct` without re-baselining.',
    tolerancePct,
    routes: sorted,
  };
  writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✓ baseline written: ${Object.keys(sorted).length} routes → scripts/bundle-size-baseline.json`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('✗ scripts/bundle-size-baseline.json missing — generate it with --update and commit it.');
  process.exit(1);
}

const baselineFile = JSON.parse(readFileSync(BASELINE, 'utf8'));
const baseline = baselineFile.routes;
const tolerance = typeof baselineFile.tolerancePct === 'number' ? baselineFile.tolerancePct / 100 : DEFAULT_TOLERANCE;
const regressions = [];
const newRoutes = [];
for (const [route, kb] of Object.entries(current)) {
  const base = baseline[route];
  if (base === undefined) {
    newRoutes.push([route, kb]);
    continue;
  }
  const budget = Math.round(base * (1 + tolerance) * 10) / 10;
  if (kb > budget) regressions.push({ route, kb, base, budget });
}
const removed = Object.keys(baseline).filter((r) => !(r in current));

for (const [route, kb] of newRoutes) {
  console.warn(`⚠ new route not in baseline: ${route} (${kb} kB) — run --update to record it`);
}
for (const route of removed) {
  console.warn(`⚠ baseline route no longer built: ${route} — run --update to prune it`);
}

if (regressions.length) {
  console.error(`\n✗ First Load JS budget exceeded on ${regressions.length} route(s):`);
  for (const { route, kb, base, budget } of regressions) {
    const pct = Math.round(((kb - base) / base) * 100);
    console.error(`    ${route}: ${kb} kB (baseline ${base} kB, +${pct}%, budget ${budget} kB)`);
  }
  console.error(
    `\nA route grew >${tolerance * 100}% in shipped JS. Trim the import (dynamic import, drop a dep, code-split),\n` +
      'or if the growth is intended, re-baseline: `node scripts/check-bundle-size.mjs --update` and commit.',
  );
  process.exit(1);
}

const total = Object.keys(current).length;
console.log(`✓ First Load JS within budget on ${total} route(s) (≤ baseline +${tolerance * 100}%)`);
