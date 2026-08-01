#!/usr/bin/env node
// Locale-parity gate (ADR-003, DEV-PHASES-PLAN W1): every key present in
// en.json must exist in all other locales, and no locale may carry keys that
// en.json lacks. Replaces the manual 10-locale checklist with a CI job.
//
// Usage: node scripts/check-locale-parity.mjs
// Exit 0 = parity holds; exit 1 = report printed, parity broken.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = new URL('../src/locales', import.meta.url).pathname;
const REFERENCE = 'en.json';

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
if (!files.includes(REFERENCE)) {
  console.error(`✗ reference locale ${REFERENCE} not found in ${LOCALES_DIR}`);
  process.exit(1);
}

const keySets = new Map(
  files.map((f) => {
    const parsed = JSON.parse(readFileSync(join(LOCALES_DIR, f), 'utf8'));
    return [f, new Set(flattenKeys(parsed))];
  }),
);

const reference = keySets.get(REFERENCE);
let broken = false;

for (const [file, keys] of keySets) {
  if (file === REFERENCE) continue;
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    broken = true;
    console.error(`✗ ${file}: ${missing.length} missing, ${extra.length} extra vs ${REFERENCE}`);
    for (const k of missing) console.error(`    missing: ${k}`);
    for (const k of extra) console.error(`    extra:   ${k}`);
  }
}

if (broken) {
  console.error(
    '\nLocale parity broken (ADR-003): every key added to en.json must land in all locales in the same MR.',
  );
  process.exit(1);
}
console.log(`✓ locale parity holds across ${files.length} locales (${reference.size} keys each)`);

// ── Untranslated-value gate ───────────────────────────────────────────────────────────
// Key parity counts KEYS, not values, so a locale can hold every key and still show English.
// That is not hypothetical: `select_your_tables` shipped as the literal "Select your Table(s)"
// in six locales and passed this script every time, which is how it reached the owner as
// "no language support" (BUGS-IMPROVEMENTS-PLAN E7).
//
// Not every match is a bug — brand names, "OK", "Menu" and "Email" are legitimately identical in
// several languages — so this is a BASELINE gate, like scripts/check-file-length.sh: the ~500
// pre-existing matches are recorded and ignored, and only NEW ones fail. It stops the next
// untranslated string without demanding a translation sweep today.
//
// Regenerate after deliberately adding one (or after translating some away):
//   node scripts/check-locale-parity.mjs --regen-baseline
const BASELINE_PATH = new URL('./locale-untranslated-baseline.json', import.meta.url).pathname;
const REGEN = process.argv.includes('--regen-baseline');

const englishValues = JSON.parse(readFileSync(join(LOCALES_DIR, REFERENCE), 'utf8'));

/** Keys whose value is byte-identical to en.json. Blank values are absence, not a match. */
function untranslatedKeys(file) {
  const parsed = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
  return (
    Object.entries(parsed)
      .filter(
        ([k, v]) => typeof v === 'string' && typeof englishValues[k] === 'string' && v === englishValues[k] && v.trim(),
      )
      .map(([k]) => k)
      // Explicit comparator, and pinned to 'en': the result is written to a baseline file that gets
      // diffed and reviewed, so the order has to be identical on every machine and in CI. A bare
      // `.sort()` sorts by UTF-16 code unit and `localeCompare` without a locale follows the host's,
      // either of which can reorder the file for no reason.
      .sort((a, b) => a.localeCompare(b, 'en'))
  );
}

const current = {};
for (const file of files) {
  if (file === REFERENCE) continue;
  current[file] = untranslatedKeys(file);
}

if (REGEN) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  const total = Object.values(current).reduce((n, keys) => n + keys.length, 0);
  console.log(`✓ untranslated baseline regenerated (${total} entries)`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
let newUntranslated = false;

for (const [file, keys] of Object.entries(current)) {
  const known = new Set(baseline[file] ?? []);
  const added = keys.filter((k) => !known.has(k));
  if (added.length) {
    newUntranslated = true;
    console.error(`✗ ${file}: ${added.length} key(s) carry the English value verbatim`);
    for (const k of added) console.error(`    untranslated: ${k} = ${JSON.stringify(englishValues[k])}`);
  }
}

if (newUntranslated) {
  console.error(
    '\nA locale value identical to en.json is usually an untranslated placeholder. Translate it, or —' +
      '\nif the word really is the same in that language — run:' +
      '\n  node scripts/check-locale-parity.mjs --regen-baseline',
  );
  process.exit(1);
}

const baselineTotal = Object.values(baseline).reduce((n, keys) => n + keys.length, 0);
const currentTotal = Object.values(current).reduce((n, keys) => n + keys.length, 0);
console.log(
  `✓ no new untranslated values (${currentTotal} known, baseline ${baselineTotal})` +
    (currentTotal < baselineTotal ? ' — some were translated; regen the baseline to bank it' : ''),
);
