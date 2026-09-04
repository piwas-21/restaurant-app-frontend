#!/usr/bin/env node
// Locale gate (ADR-003, DEV-PHASES-PLAN W1) — three checks over src/locales/*.json, in this order:
//
//   1. KEY parity      — every key in en.json exists in all other locales and nowhere else; nested
//                        groups are flattened to dotted paths, so `cashier.zreport.title` counts
//                        whether a bundle spells it nested or flat. A PLURAL key is a FAMILY, not a
//                        key: `items_one`/`items_other` in en.json means every locale must carry
//                        exactly the categories `Intl.PluralRules` gives it — six for `ar`, one for
//                        `zh` — no more, no less (#590).
//   2. EMPTY values    — no key may be null, blank or a non-string in ANY bundle. Zero tolerance,
//                        no baseline: a key present with no value renders the English fallback, so
//                        the bundle looks complete and the screen shows English (#610).
//   3. PLACEHOLDER parity — every `{{interpolation}}` en.json carries survives in every locale
//                        (baseline `locale-placeholder-baseline.json`, currently EMPTY = zero
//                        tolerance).
//   4. UNTRANSLATED values — no locale value is byte-identical to the English one. Walks TOP-LEVEL
//                        *and* NESTED keys (baseline `locale-untranslated-baseline.json`).
//
// Replaces the manual 10-locale checklist with a CI job (`.github/workflows/ci.yml` → `i18n_parity`).
//
// Usage: node scripts/check-locale-parity.mjs
//        node scripts/check-locale-parity.mjs --regen-baseline   # rewrites BOTH baselines
// Exit 0 = all four hold; exit 1 = report printed.
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

/** The same walk, carrying VALUES: one `[dottedPath, value]` pair per leaf. */
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? flatten(v, path) : [[path, v]];
  });

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

// ── Plural key FAMILIES (#590) ────────────────────────────────────────────────────────
// i18next spells one plural sentence as a family of suffixed keys, and the categories a language
// HAS are not the same in every language. Requiring a byte-identical key set across ten bundles
// therefore made a correct plural impossible in both directions at once: `ar` needs `_zero _one
// _two _few _many _other`, which en.json does not have (reported `extra`), and `zh` must NOT carry
// `_one`, which en.json does (reported `missing`). There was no baseline and no escape hatch, so
// three merged PRs (#569, #582, #589) each independently rewrote a counted sentence — "10 languages"
// → "10", "Add 3 ingredients" → "Add selected (3)" — to get past the gate. A gate that keeps
// rewriting the product's copy is the defect.
//
// The required set comes from `Intl.PluralRules`, NOT from a hand-written table, for a reason that
// is the whole point: i18next picks its runtime suffix from the same ICU data, so the gate demands
// exactly the keys the renderer will look up. (It also corrects two beliefs the issue carried:
// CLDR gives Turkish TWO categories, not one, and gives fr/es/it a `_many` for compact millions.)
//
// This is a LOOSENING of key parity, so it is bounded deliberately:
//   - a base is a family only when en.json has BOTH `base_one` and `base_other`, so an ordinary key
//     that merely ends in `_zero` (`discount_value_must_be_greater_than_zero`) is untouched;
//   - within a family the check is STRICTER than before, not weaker — `ru` must now SUPPLY `_few`
//     and `_many` and `ar` all six, where the old rule could only forbid them;
//   - en.json is checked against its own categories too, so a stray `items_few` in English fails;
//   - every non-family key keeps byte parity, a hard zero.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** The categories a locale really has, from the same ICU data i18next resolves suffixes with. */
function pluralCategories(file) {
  const locale = file.replace(/\.json$/, '');
  try {
    return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  } catch {
    console.error(`✗ ${file}: not a locale tag Intl.PluralRules understands — cannot derive plural categories`);
    process.exit(1);
  }
}

/** Bases that en.json declares plural. `_one` AND `_other` — one suffix alone proves nothing. */
const pluralBases = new Set(
  [...reference]
    .filter((k) => PLURAL_SUFFIX.test(k))
    .map((k) => k.replace(PLURAL_SUFFIX, ''))
    .filter((base) => reference.has(`${base}_one`) && reference.has(`${base}_other`)),
);

/** `{ base, category }` when the key belongs to a declared family, else null. */
const pluralMember = (key) => {
  const match = PLURAL_SUFFIX.exec(key);
  if (!match) return null;
  const base = key.slice(0, -match[0].length);
  return pluralBases.has(base) ? { base, category: match[1] } : null;
};

const nonPluralKeys = [...reference].filter((k) => !pluralMember(k));

/** The exact key set this locale must carry: every plain key, plus its own plural categories. */
const expectedKeys = (file) =>
  new Set([...nonPluralKeys, ...[...pluralBases].flatMap((b) => pluralCategories(file).map((c) => `${b}_${c}`))]);

let broken = false;

for (const [file, keys] of keySets) {
  const expected = expectedKeys(file);
  const missing = [...expected].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !expected.has(k));
  if (missing.length || extra.length) {
    broken = true;
    const against = file === REFERENCE ? 'its own plural categories' : `expected set derived from ${REFERENCE}`;
    console.error(`✗ ${file}: ${missing.length} missing, ${extra.length} extra vs ${against}`);
    // Name the rule that demands it — "missing: items_many" alone reads like a typo in en.json.
    const why = (k) => (pluralMember(k) ? ` (plural category '${pluralMember(k).category}' — required by ${file})` : '');
    const notHere = (k) => (PLURAL_SUFFIX.test(k) ? ` (category not in ${file})` : '');
    for (const k of missing) console.error(`    missing: ${k}${why(k)}`);
    for (const k of extra) console.error(`    extra:   ${k}${notHere(k)}`);
  }
}

if (broken) {
  console.error(
    '\nLocale parity broken (ADR-003): every key added to en.json must land in all locales in the same MR.' +
      '\nA plural key is a FAMILY: each locale carries exactly the categories Intl.PluralRules gives it.',
  );
  process.exit(1);
}
console.log(
  `✓ locale parity holds across ${files.length} locales ` +
    `(${nonPluralKeys.length} keys + ${pluralBases.size} plural famil${pluralBases.size === 1 ? 'y' : 'ies'} each)`,
);

// ── EMPTY-VALUE gate (#610) ───────────────────────────────────────────────────────────
// A key present with NO value is strictly worse than a key that is absent: i18next falls back to
// the English string, so the bundle looks complete and the screen shows English.
//
// It fell through BOTH halves of this script, which is how it reached production. Key parity counts
// KEYS, and the walks above treat `null` as a leaf, so the key IS there and parity holds. The
// untranslated check compares values TO ENGLISH, and `null` is not equal to the English string, so
// it is not a match either. Four `cashier.*` order statuses (`pending`, `confirmed`, `preparing`,
// `ready`) sat `null` in `tr.json` on prod for exactly that reason — a Turkish cashier read English
// order statuses while every gate was green.
//
// Zero tolerance and no baseline: unlike an untranslated value, an empty one is never legitimate.
// The type check is part of the same rule — a number, a boolean or an array is not a translation
// either, and the walk above yields all three as leaves.
const emptyValues = [];
for (const file of files) {
  const bundle = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
  for (const [key, value] of flatten(bundle)) {
    if (typeof value !== 'string') emptyValues.push(`${file}:${key} = ${JSON.stringify(value)}`);
    else if (!value.trim()) emptyValues.push(`${file}:${key} = ${JSON.stringify(value)} (blank)`);
  }
}
if (emptyValues.length) {
  console.error(`✗ ${emptyValues.length} key(s) present with no usable value:`);
  for (const entry of emptyValues) console.error(`    ${entry}`);
  console.error(
    '\nA key whose value is null, blank or not a string renders as the English fallback, so the' +
      '\nbundle looks complete and the screen shows English. Neither half of this gate could see it:' +
      '\nkey parity counts KEYS, and the untranslated check compares values TO ENGLISH — which null' +
      '\nis not equal to. Translate it, or remove the key from every bundle.',
  );
  process.exit(1);
}
console.log(`✓ every key in all ${files.length} locales carries a non-empty string value`);



// ── Placeholder-parity gate ───────────────────────────────────────────────────────────
// Key parity counts keys and the value gate below compares values TO ENGLISH, so a locale can hold
// every key, be properly translated, and still have lost an interpolation: a German string missing
// `{{max}}` is not equal to the English one, so nothing above notices. i18next then renders the
// sentence with the number silently absent.
//
// The live example is `cashier.refund_exceeds_payment` (#417) — "Refund amount cannot exceed the
// payment amount of {{max}}". Drop `{{max}}` from one bundle and a cashier is told the refund is
// too large without being told the limit, which is the whole point of the message.
//
// Compares the SET of placeholder names, not their order: word order legitimately differs between
// languages, so position carries no meaning and demanding it would fail on correct translations.
const placeholdersIn = (value) =>
  typeof value === 'string' ? new Set([...value.matchAll(/\{\{\s*([\w.]+)\s*}}/g)].map((m) => m[1])) : new Set();


const englishBundle = JSON.parse(readFileSync(join(LOCALES_DIR, REFERENCE), 'utf8'));
const enPairs = flatten(englishBundle);

/**
 * Resolve as i18next does — NESTED path first, then the literal flat key.
 *
 * Load-bearing, and the first draft of this check got it wrong in the way the bundles punish:
 * `en.json` holds both a `cashier` OBJECT and 182 FLAT `cashier.*` keys, so walking the dotted path
 * alone returns undefined for every flat one and reports its placeholders "dropped" in all nine
 * locales — a gate that fails on correct data is worse than no gate.
 */
const readValue = (obj, path) =>
  path.split('.').reduce((node, part) => (node !== null && typeof node === 'object' ? node[part] : undefined), obj) ??
  obj[path];

/**
 * The English value the two value gates below must judge a key against.
 *
 * For a plural category en.json does not have — `items_few` in `ru`, `items_two` in `ar` — that is
 * the English `_other`. Without this, `readValue(en, 'items_few')` is `undefined` and BOTH value
 * gates fall silent on exactly the keys #590 just made legal: an Arabic `_few` could drop
 * `{{count}}`, or ship the English sentence verbatim, and the run would still be green.
 */
const englishValueFor = (key) => {
  const direct = readValue(englishBundle, key);
  if (direct !== undefined) return direct;
  const member = pluralMember(key);
  return member ? readValue(englishBundle, `${member.base}_other`) : undefined;
};

// Baselined when it was introduced, because its first run found 72 PRE-EXISTING mismatches. **That
// baseline is now EMPTY**, so this is a zero-tolerance gate: any mismatch is new.
//
// The 72 were worth the sweep rather than the tolerance. 63 of them were the same defect —
// `{{city}}` replaced by a hardcoded "Genève" / "Женеве" / "日内瓦" in nine languages, across the
// page titles and meta descriptions of the home, menu and reservations pages. That is not a missing
// interpolation, it is TENANT-1's city baked into shared locale files: every other tenant's Russian
// page title said they were in Geneva. The remaining 9 were two keys whose translations had drifted
// to a different sentence entirely and so carried no placeholder to lose.
//
// Two limits worth knowing before trusting a green run here. Russian and Turkish DECLINE a city
// name ("в Женеве", "Cenevre'deki"), and interpolation cannot — so those strings now read with an
// uninflected city, which is a grammar cost accepted deliberately against naming the wrong city.
// And this gate only compares placeholders that EXIST in `en.json`, so a key that hardcodes a
// tenant value in the ENGLISH source has nothing to compare and stays invisible here — no amount
// of green proves the English is tenant-neutral. `home_hero_subtitle` was exactly that case (it
// read "…Begins Here in Geneva", propagating to all ten locales); it now carries `{{city}}`, so
// the gate covers it. Finding the next one means reading en.json, not re-running this.
const PLACEHOLDER_BASELINE = new URL('./locale-placeholder-baseline.json', import.meta.url).pathname;
const REGEN_BASELINES = process.argv.includes('--regen-baseline');

const placeholderMismatches = [];
for (const file of files) {
  if (file === REFERENCE) continue;
  const bundle = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
  // Every key this locale is REQUIRED to carry, which for a plural family is its own categories —
  // iterating `enPairs` alone would check `items_one`/`items_other` and skip `ar`'s other four.
  for (const key of expectedKeys(file)) {
    const expected = placeholdersIn(englishValueFor(key));
    if (expected.size === 0) continue;
    const actual = placeholdersIn(readValue(bundle, key));
    const dropped = [...expected].filter((p) => !actual.has(p));
    const invented = [...actual].filter((p) => !expected.has(p));
    if (dropped.length || invented.length) placeholderMismatches.push(`${file}:${key}`);
  }
}
// Same reason as the sort above: a committed baseline must not reorder itself on another machine.
placeholderMismatches.sort((a, b) => a.localeCompare(b, 'en'));

if (REGEN_BASELINES) {
  writeFileSync(PLACEHOLDER_BASELINE, `${JSON.stringify(placeholderMismatches, null, 2)}\n`);
  console.log(`✓ placeholder baseline regenerated (${placeholderMismatches.length} entries)`);
} else {
  const knownPlaceholder = new Set(JSON.parse(readFileSync(PLACEHOLDER_BASELINE, 'utf8')));
  const newMismatches = placeholderMismatches.filter((m) => !knownPlaceholder.has(m));
  if (newMismatches.length) {
    console.error(`✗ ${newMismatches.length} NEW interpolation placeholder mismatch(es) vs en.json:`);
    for (const m of newMismatches) console.error(`    ${m}`);
    console.error(
      '\nAn interpolation present in en.json must appear in every locale, or its value renders with' +
        '\nthe number or name silently missing — which no other gate here can see: key parity counts' +
        '\nkeys, and the untranslated check compares values TO ENGLISH, which a translated-but-broken' +
        '\nstring passes.',
    );
    process.exit(1);
  }
  const shrunk = placeholderMismatches.length < knownPlaceholder.size ? ' — some were fixed; --regen-baseline' : '';
  console.log(
    `✓ no new placeholder mismatches (${placeholderMismatches.length} known, baseline ${knownPlaceholder.size})${shrunk}`,
  );
}

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
// COVERAGE — top-level AND nested keys. The first version of this check walked
// `Object.entries(bundle)` only, so it saw the 2515 flat keys and none of the 85 living inside the
// `cashier` / `privacy_policy` / `terms_of_usage` OBJECTS. That left the gate blind in exactly the
// shape of the defect it was written for: a nested key could ship the English string in all ten
// locales, green, because key parity counts keys and this check never looked inside a group. It now
// flattens to dotted paths (`cashier.zreport.total_tips`) and reports in that same shape, which is
// also the shape the baseline stores — so widening it added 9 entries (proper nouns and short words
// that really are identical: "Type", "Txns", "Product", "Transactions", "1. Introduction") and
// removed none.
//
// Values are resolved through `readValue` — NESTED path first, then the literal flat key, exactly as
// i18next does and for the same reason the placeholder gate does it (see its note above): en.json
// holds a `cashier` object *and* 182 flat `cashier.*` keys, and `es`/`tr` nest five keys that en
// keeps flat. Comparing the value i18next would actually render is the only way that data reads
// correctly from both sides.
//
// Regenerate after deliberately adding one (or after translating some away):
//   node scripts/check-locale-parity.mjs --regen-baseline
const BASELINE_PATH = new URL('./locale-untranslated-baseline.json', import.meta.url).pathname;
const REGEN = process.argv.includes('--regen-baseline');

const englishValues = JSON.parse(readFileSync(join(LOCALES_DIR, REFERENCE), 'utf8'));

/**
 * Keys whose value is byte-identical to en.json, at any depth. Blank values are absence, not a match.
 *
 * `flatten` yields one dotted path per LEAF, so a nested group contributes `cashier.zreport.amount`
 * and a flat key contributes itself unchanged — top-level entries keep the exact key shape the
 * baseline has always stored. Deduped because a bundle is free to spell the same path both ways.
 */
function untranslatedKeys(file) {
  const bundle = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
  return (
    [...new Set(flatten(bundle).map(([path]) => path))]
      .filter((path) => {
        const value = readValue(bundle, path);
        const english = englishValueFor(path);
        return typeof value === 'string' && typeof english === 'string' && value === english && value.trim();
      })
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
    // readValue, not `englishValues[k]`: a nested key has no flat entry, so indexing printed
    // `undefined` for every one of them — a report that names the key but hides the string.
    for (const k of added) console.error(`    untranslated: ${k} = ${JSON.stringify(englishValueFor(k))}`);
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
