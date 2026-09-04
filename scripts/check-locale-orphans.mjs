#!/usr/bin/env node
// Orphan-key gate (#439) — a key nothing reads is a key nobody maintains.
//
// `check-locale-parity.mjs` answers "does every locale have the same keys as en.json?". It never
// asks "does anything READ this key?", so a key deleted from a component stays in all ten bundles
// forever, fully parity-compliant, and every gate stays green. The survey behind #439 found 581 of
// 2966 keys (19.6%) with no reference anywhere — ~5,800 dead JSON lines carried through every
// future translation pass, and noise that hid two real bugs (#210 shipped English in `ru`, #134
// hardcoded a city) in a file where a fifth of the content is unreachable.
//
// Usage: node scripts/check-locale-orphans.mjs
//        node scripts/check-locale-orphans.mjs --list   # print every orphan, one per line
// Exit 0 = no unexplained orphan; exit 1 = report printed. Warnings never fail.
//
// ── The three ways a gate like this goes WRONG, each measured on this repo ──────────────────────
//
// 1. SCANNING CALLSITES INSTEAD OF TEXT. 16 files hold a literal KEY TABLE — `ORDER_STATUS_META`,
//    `PAYMENT_STATUS_META`, `MENU_TYPE_FILTER_LABEL_KEYS`, `DAY_KEYS`, `libraryPickerCopy` … — and
//    call `t(TABLE[x].key)`. There is no literal at the callsite, but the key IS a literal in the
//    table. A gate that looks for `t('literal')` reports every one of them dead. So this scans for
//    the key STRING anywhere in the corpus, never for the shape of the call.
//
// 2. TREATING A DERIVED FILE AS CODE. `scripts/*-baseline.json` are GENERATED FROM en.json, so they
//    name the very keys under test. Including them marks 75 orphans as live — a fail-OPEN hole in
//    exactly the gate this is. They are excluded, and there is a fixture pinning that.
//
// 3. DELETING A KEY THAT IS BUILT AT RUNTIME. 138 keys are composed from a prefix
//    (`t(`allergen_${a}`)`), and `categoryNameMapper` lowercases a category name a TENANT typed
//    into the production database and uses it as a key. The first set is allowlisted by prefix; the
//    second cannot be settled from source AT ALL, so those keys are WARNED about, never failed on.
//
// The bias throughout is fail-CLOSED against deletion: when the evidence is ambiguous the key is
// treated as USED. This gate's job is to stop the NEXT orphan, not to win an argument about an
// existing one.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LOCALES_DIR = join(ROOT, 'src/locales');
const CORPUS_ROOTS = ['src', 'e2e', 'scripts'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);

/**
 * Prefixes the codebase composes a key from at RUNTIME, so no literal exists to find.
 *
 * Derived by reading all 137 non-literal `t()` callsites, not guessed. Verified as a set: every one
 * of the 138 runtime-composed keys in en.json starts with one of these, and the fixture suite pins
 * that a key OUTSIDE them is still reported.
 */
const DYNAMIC_PREFIXES = [
  'allergen_',
  'api_tokens_scope_desc_',
  'api_tokens_status_',
  'discount_type_',
  'editor_floor_',
  'editor_item_',
  'editor_opening_',
  'editor_palette_',
  'editor_shape_',
  'editor_swing_',
  'image_backfill_outcome_',
  'kitchen_type_',
  'lang_',
  'language_',
  'my_reservations_status_',
  'order_status_',
  'payment_status_',
  'product_type_',
  'roles.',
  'setup_step_',
  'step_blocked_',
];

/**
 * Keys no static analysis can settle. WARNED, never failed on, and never deleted without a human.
 *
 * `src/utils/categoryNameMapper.ts:38` is the irreducible case:
 *
 *     return mapping[apiCategoryName] || apiCategoryName.toLowerCase();   // → t(key)
 *
 * A sixteen-entry map, and then ANY category name a tenant typed into their database, lowercased,
 * becomes a translation key. `salads`, `meze`, `seafood` are ordinary restaurant categories. The
 * backend carries no category seed data, so the truth for these lives in a production database and
 * not in any repository. The rest are short words that also occur as identifiers or in prose, where
 * "no reference" cannot be told apart from "referenced by something I cannot parse".
 */
const UNPROVABLE = [
  'cancelling',
  'cashier.refresh_failed',
  'choose',
  'each',
  'english',
  'filters',
  'german',
  'language',
  'meze',
  'more',
  'of',
  'options',
  'products',
  'refunding',
  'salads',
  'seafood',
  'standard',
  'zones',
];

/**
 * `src/locales/**.json` is the DATA under test; `scripts/*-baseline.json` is GENERATED from it.
 *
 * Note what is NOT excluded: `src/locales/*.test.ts`. Those suites name a handful of real keys in
 * their fixtures (`cashier.pending`, `home_page_description`, …), and eleven keys are "used" only
 * because of that. Excluding them would be defensible — a fixture is not a product reference — but
 * it is a JUDGEMENT, not a measurement, and it is the judgement that deletes eleven live-looking
 * keys. The gate takes the conservative side and counts them.
 */
const isExcluded = (rel) =>
  /^src\/locales\/.*\.json$/.test(rel) ||
  // THIS FILE, and its own fixtures. Both name the very keys the gate judges — the allowlists here,
  // and `salads` / `meze` / `german` in the suite that proves the warning fires — so without these
  // two lines every allowlisted key marks itself used and the warning can never fire on the real
  // tree. A gate's own allowlist is not a reference, for the same reason a derived baseline is not.
  // Note this is the ONLY locale test excluded: `localeUntranslatedGate.test.ts` and friends stay
  // in, and eleven real keys are "used" only because their fixtures name them. Dropping those would
  // be defensible and is a JUDGEMENT, not a measurement — so the gate takes the conservative side.
  rel === 'scripts/check-locale-orphans.mjs' ||
  rel === 'src/locales/localeOrphanGate.test.ts' ||
  /^scripts\/[\w-]*baseline\.json$/.test(rel) ||
  rel.includes('node_modules/') ||
  rel.includes('/.next/') ||
  rel.includes('-snapshots/');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) yield* walk(abs);
    else yield abs;
  }
}

const corpusFiles = [];
for (const root of CORPUS_ROOTS) {
  const abs = join(ROOT, root);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file);
    if (CODE_EXT.has(extname(file)) && !isExcluded(rel)) corpusFiles.push(file);
  }
}
const corpus = corpusFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

/**
 * Every identifier-or-dotted-path token in the corpus.
 *
 * Quotes delimit, so a key written as a complete string literal — `t('save_now')`, `{ key: 'x.y' }`,
 * or one nested inside a template literal — always lands here as its OWN token. That is what makes
 * the key-table case (failure mode 1 above) work without parsing anything.
 */
// The shape is `identifier(.identifier)*` rather than a character class containing the dot, so a
// token can never END in one and there is no trailing-dot strip to do. The first draft was
// `[A-Za-z_][A-Za-z0-9_.]*` + `.replace(/\.+$/, '')`, whose anchored `\.+$` backtracks
// super-linearly on a long token — on a 7 MB corpus that is a cost, not a curiosity.
const tokens = new Set();
for (const [token] of corpus.matchAll(/[A-Za-z_]\w*(?:\.\w+)*/g)) tokens.add(token);

const flattenKeys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? flattenKeys(v, path) : [path];
  });

const englishKeys = flattenKeys(JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8')));

const orphans = [];
for (const key of englishKeys) {
  if (tokens.has(key)) continue;
  if (DYNAMIC_PREFIXES.some((p) => key.startsWith(p))) continue;
  // Last resort before accusing a key: the key as a WHOLE word anywhere in the corpus, comments
  // included. Boundaries are word characters only, so `a.b.c` still counts as a use of `b` (a key
  // reached through a dotted path) while `all_categories_nav` does NOT count as a use of
  // `all_categories` — the second was measured: 55 dead keys are a strict prefix of a LIVE key, and
  // a plain `includes()` calls every one of them alive. Comments count as a use on purpose: a key
  // somebody wrote down deliberately gets a human, not a silent delete.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  if (new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(corpus)) continue;
  orphans.push(key);
}

const unprovable = new Set(UNPROVABLE);
const warned = orphans.filter((k) => unprovable.has(k));
const failing = orphans.filter((k) => !unprovable.has(k));

if (process.argv.includes('--list')) for (const key of orphans) console.log(key);

if (warned.length) {
  console.warn(`⚠ ${warned.length} orphan(s) that no static analysis can settle — allowlisted, not failed on:`);
  for (const key of warned) console.warn(`    ${key}`);
  console.warn('  See UNPROVABLE in this file. Removing one of these needs a human, not a green run.');
}

if (failing.length) {
  console.error(`✗ ${failing.length} locale key(s) with no reference in src/, e2e/ or scripts/:`);
  for (const key of failing) console.error(`    orphan: ${key}`);
  console.error(
    '\nA key nothing reads is carried in all ten bundles and re-translated on every locale pass.' +
      '\nDelete it from all ten, or — if it is composed at runtime — add its PREFIX to' +
      '\nDYNAMIC_PREFIXES in scripts/check-locale-orphans.mjs with the callsite in the commit message.',
  );
  process.exit(1);
}

const allowlisted = warned.length ? `, ${warned.length} allowlisted` : '';
console.log(`✓ no orphaned locale keys (${englishKeys.length} keys, ${corpusFiles.length} files scanned${allowlisted})`);
