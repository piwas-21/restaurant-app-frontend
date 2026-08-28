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
// is a non-empty string. Only a real second argument counts here.
//
// To be exact about the scale, since this is the file a future reader will consult: ~207 such
// callsites exist across `src/`. Almost all are INERT — their key resolves, so the dead branch never
// mattered — and they are left alone. Six were not: their key was in no bundle, so the English text
// beside them had never rendered and the user saw the key. Those six are fixed. The pattern is a
// smell, not a bug; this gate flags the keys, not the `||`.
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
 * (`ignoreJSONStructure`). Both forms are in use — `en.json` holds a `cashier` object AND 182 flat
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
 * Blank out comments while KEEPING string contents. Both halves matter: `t('…')` is talked about
 * more than it is written (the E9 doc comments contain `?? t('…')` and `t('contextual')` as
 * examples, which put two phantom keys in the first draft of this gate), and the keys themselves
 * live inside string literals.
 *
 * ORDER IS THE WHOLE MECHANISM. A string alternative is tried before either comment alternative, so
 * the slash-star inside an `accept="image/…"` attribute is consumed as part of the string token and
 * can never open a comment. A plain block-comment regex has no such protection: it treated that
 * slash-star as an opener and deleted everything up to the next close marker, which in
 * `ProductDetails.tsx` and `BundlePanel.tsx` swallowed a real `t()` callsite several lines below —
 * a fail-OPEN hole in a gate whose entire purpose is to fail closed.
 *
 * (`scripts/lib/ratchet.mjs` solves the same hazard for the E9 ratchet, but by CONSUMING string
 * contents — which is exactly what this scan needs to read, hence a local pass rather than a reuse.)
 *
 * Quoted strings exclude `\n`, so one unbalanced apostrophe in prose cannot swallow the rest of the
 * file; template literals allow it, since they legitimately span lines. The closing delimiter is
 * optional so an unterminated literal ends at the newline instead of failing to match and letting
 * the scan fall through to the comment alternatives.
 *
 * Comments become spaces and keep their newlines, so offsets stay aligned with the original and the
 * `defaultValue` lookahead below cannot be dragged across a blanked span.
 */
// Assembled from named parts rather than written as one literal: the two quote characters differ
// only in the delimiter, so a backreference states that instead of duplicating the alternative, and
// each remaining piece says what it is.
const QUOTED = String.raw`(['"])(?:\\.|(?!\1)[^\\\n])*\1?`;
const TEMPLATE = String.raw`\`(?:\\.|[^\\\`])*\`?`;
const LINE_COMMENT = String.raw`//[^\n]*`;
const BLOCK_COMMENT = String.raw`/\*[\s\S]*?\*/`;

const STRING_OR_COMMENT = new RegExp([QUOTED, TEMPLATE, LINE_COMMENT, BLOCK_COMMENT].join('|'), 'g');

const blankComments = (source) =>
  source.replace(STRING_OR_COMMENT, (token) =>
    token.startsWith('//') || token.startsWith('/*') ? token.replace(/[^\n]/g, ' ') : token,
  );

// `t(` is not the only way a key reaches a user. The home templates render a two-pass
// `copy('key')` (src/lib/staticCopy.ts) whose pre-hydration half is `staticText('key')`, resolved
// against en.json by hand rather than by i18next — same bundle, same missing-key tell (the key
// itself), so the same gate has to see it. Without these two alternatives, moving a callsite from
// `t(` to `copy(` would silently drop it out of this scan.
const CALL = /\b(?:t|copy|staticText)\(\s*(['"])([^'"]+)\1\s*(,)?/g;
const missing = new Map(); // key -> { hasDefault, sites:Set }

for (const file of sourceFiles) {
  const src = blankComments(readFileSync(file, 'utf8'));
  let m;
  while ((m = CALL.exec(src))) {
    const key = m[2];
    if (resolve(en, key) !== undefined) continue;

    // A second argument counts as a default when it is a string literal, or an options object
    // carrying `defaultValue` — `t('k', { count, defaultValue: '…' })`.
    const after = m[3] === ',' ? src.slice(CALL.lastIndex).trimStart() : '';
    const hasDefault =
      /^['"`]/.test(after) || (after.startsWith('{') && /\bdefaultValue\s*:/.test(after.slice(0, 400)));

    const entry = missing.get(key) ?? { hasDefault: false, sites: new Set() };
    // A key called from several places counts as defaulted only if EVERY call defaults it —
    // otherwise the one bare call is what a user sees.
    entry.hasDefault = entry.sites.size === 0 ? hasDefault : entry.hasDefault && hasDefault;
    entry.sites.add(relative(root, file));
    missing.set(key, entry);
  }
}

// `localeCompare(…, 'en')` on every sort here, matching `check-locale-parity.mjs`: a bare `.sort()`
// orders by UTF-16 code unit and a locale-less compare follows the HOST's locale, either of which
// can reorder a committed baseline on a different machine for no reason.
const byName = (a, b) => a.localeCompare(b, 'en');

const raw = [...missing].filter(([, v]) => !v.hasDefault).sort(([a], [b]) => byName(a, b));
const defaulted = [...missing]
  .filter(([, v]) => v.hasDefault)
  .map(([k]) => k)
  .sort(byName);

if (REGEN) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ defaulted }, null, 2)}\n`);
  console.log(`✓ t()-key baseline regenerated (${defaulted.length} keys missing but defaulted)`);
  process.exit(0);
}

let failed = false;

if (raw.length) {
  failed = true;
  console.error(`✗ ${raw.length} t() key(s) resolve in NO locale and carry no default — a user sees the raw key:`);
  for (const [key, v] of raw) console.error(`    ${key}\n        ${[...v.sites].join('\n        ')}`);
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

// The other direction, and the half that turns 106 from a ceiling into a burn-down (#599).
//
// A baselined key that has since been TRANSLATED stays listed until someone re-runs `--regen`, so
// the number could only ever say "it did not get worse" — progress was invisible and the file drifted
// out of step with the code that produced it. Every entry here must still be a real one, which makes
// this list shrink-only: it may not grow (above) and it may not go stale (here).
//
// A key leaves `defaulted` for exactly two reasons and both mean the same thing for this file —
// it is no longer a backlog item: it now RESOLVES in en.json (the good case, someone translated it),
// or its call site is gone. `--regen` is the fix for both; there is nothing to decide.
const stillMissing = new Set(defaulted);
const stale = [...known].filter((k) => !stillMissing.has(k));
if (stale.length) {
  failed = true;
  console.error(`\n✗ ${stale.length} baselined key(s) are no longer missing — the backlog list is stale:`);
  for (const k of stale) console.error(`    ${k}`);
  console.error('\n  Each now resolves in en.json, or its callsite is gone. Bank the progress:');
  console.error('      node scripts/check-t-keys.mjs --regen');
}

if (failed) process.exit(1);

console.log(`✓ no t() key renders raw; ${defaulted.length} defaulted-but-missing (baseline ${known.size})`);
