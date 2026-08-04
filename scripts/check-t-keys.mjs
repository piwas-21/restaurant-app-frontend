#!/usr/bin/env node
// Missing-translation-key gate (issue #417).
//
// `src/i18n.ts` configures no `parseMissingKeyHandler`, so i18next renders THE KEY ITSELF when a
// key resolves to nothing. That is how 18 keys — ten of them on the cashier's QR/refund path, used
// every shift — came to render as `cashier.invalid_qr_code` on a staff screen.
//
// Why the sibling gate could not see it: `check-locale-parity.mjs` compares the ten bundles against
// EACH OTHER, so a key missing from all ten is perfectly consistent and passes. And every component
// test stubs `t` as `(key) => key`, which renders the key by design — the tests agreed with the bug.
// A gate that reads the CALLSITES is the only thing that closes it.
//
// Two classes, deliberately treated differently:
//
//   - no inline default  → ERROR. A user sees the raw key. This must stay at zero.
//   - inline default     → BASELINED. `t('k', 'English')` or `t('k', { defaultValue })` shows English
//                          to all ten locales, which is a translation backlog, not a defect. The
//                          count may not GROW.
//
// ⚠️ A dead `||` fallback is NOT a default, and this is the trap #417 was made of:
// `t('k') || 'English'` can never reach its right-hand side, because `t()` returns the key and a key
// is a non-empty string. Six callsites carried one and every reader took them for working
// fallbacks. Only a real second argument counts here.
//
//   node scripts/check-t-keys.mjs                 # verify
//   node scripts/check-t-keys.mjs --regen         # re-baseline after translating some
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(root, 'scripts', 't-keys-baseline.json');
const REGEN = process.argv.includes('--regen');

const en = JSON.parse(readFileSync(join(root, 'src/locales/en.json'), 'utf8'));

/**
 * Resolve exactly as i18next does: the NESTED path first, then the literal flat key
 * (`ignoreJSONStructure`). Both forms are in use — `en.json` holds a `cashier` object AND 174 flat
 * `cashier.*` keys — so checking only one of them reports keys missing that are present all along,
 * and a nested key added beside an existing flat one silently SHADOWS it.
 */
const resolve = (bundle, key) =>
  key.split('.').reduce((node, part) => (typeof node === 'object' && node !== null ? node[part] : undefined), bundle) ??
  bundle[key];

const sourceFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== 'node_modules') walk(p);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      sourceFiles.push(p);
    }
  }
})(join(root, 'src'));

/**
 * Comments are stripped first, because `t('…')` is TALKED ABOUT more than it is written here: the
 * E9 doc comments contain `?? t('…')` and `t('contextual')` as examples, and counting those put two
 * phantom keys in the first draft of this gate.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CALL = /\bt\(\s*(['"])([^'"]+)\1\s*(,)?/g;
const missing = new Map(); // key -> { hasDefault, sites:Set }

for (const file of sourceFiles) {
  const src = stripComments(readFileSync(file, 'utf8'));
  let m;
  while ((m = CALL.exec(src))) {
    const key = m[2];
    if (resolve(en, key) !== undefined) continue;

    let hasDefault = false;
    if (m[3] === ',') {
      const after = src.slice(CALL.lastIndex).trimStart();
      if (/^['"`]/.test(after)) hasDefault = true;
      // `t('k', { count, defaultValue: '…' })` — an options object may carry the default too.
      else if (after.startsWith('{') && /\bdefaultValue\s*:/.test(after.slice(0, 400))) hasDefault = true;
    }

    const entry = missing.get(key) ?? { hasDefault: false, sites: new Set() };
    // A key called from several places counts as defaulted only if EVERY call defaults it —
    // otherwise the one bare call is what a user sees.
    entry.hasDefault = entry.sites.size === 0 ? hasDefault : entry.hasDefault && hasDefault;
    entry.sites.add(relative(root, file));
    missing.set(key, entry);
  }
}

const raw = [...missing].filter(([, v]) => !v.hasDefault);
const defaulted = [...missing]
  .filter(([, v]) => v.hasDefault)
  .map(([k]) => k)
  .sort();

if (REGEN) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ defaulted }, null, 2)}\n`);
  console.log(`✓ t()-key baseline regenerated (${defaulted.length} keys missing but defaulted)`);
  process.exit(0);
}

let failed = false;

if (raw.length) {
  failed = true;
  console.error(`✗ ${raw.length} t() key(s) resolve in NO locale and carry no default — a user sees the raw key:`);
  for (const [key, v] of raw.sort()) console.error(`    ${key}\n        ${[...v.sites].join('\n        ')}`);
  console.error("\n  Add the key to all ten locales (src/locales/*.json). A `|| 'English'` after the");
  console.error('  call is NOT a fix — `t()` returns the key, which is truthy, so it never runs.');
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const known = new Set(baseline.defaulted ?? []);
const added = defaulted.filter((k) => !known.has(k));
if (added.length) {
  failed = true;
  console.error(`\n✗ ${added.length} new key(s) missing from every locale, shown as an English default:`);
  for (const k of added) console.error(`    ${k}`);
  console.error('\n  Add them to src/locales/*.json rather than growing this backlog.');
}

if (failed) process.exit(1);

const shrunk = defaulted.length < known.size ? ' — some were added to the bundles; --regen to bank it' : '';
console.log(`✓ no t() key renders raw; ${defaulted.length} defaulted-but-missing (baseline ${known.size})${shrunk}`);
