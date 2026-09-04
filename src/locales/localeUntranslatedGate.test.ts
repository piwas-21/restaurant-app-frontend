import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * The untranslated-value half of `scripts/check-locale-parity.mjs`, exercised as CI runs it.
 *
 * Track E7 shipped the literal "Select your Table(s)" into six locales while the key-count parity
 * check stayed green, and the untranslated check was written to stop the next one. It could not:
 * it walked `Object.entries(bundle)` — TOP-LEVEL keys only — so the ~85 keys living inside the
 * `cashier` / `privacy_policy` / `terms_of_usage` objects were invisible to it. A nested key could
 * carry the English string in all ten locales and the gate reported "no new untranslated values",
 * which is the exact failure mode it exists to prevent, one nesting level down.
 *
 * The test runs the REAL script against fixture bundles in a temp tree rather than re-implementing
 * its logic: the script resolves both `src/locales/` and its baselines relative to its own file, so
 * copying it beside a fixture `src/locales/` is enough, and no test-only hook has to exist in a
 * production gate. Mutation-proved by pointing this suite at the pre-fix script — the two nested
 * cases below go red (the gate exits 0 on a bundle that is plainly English), the rest stay green.
 */

const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-locale-parity.mjs');
const SHIPPED_BASELINE = join(REPO_ROOT, 'scripts/locale-untranslated-baseline.json');

type Bundle = Record<string, unknown>;

const workdirs: string[] = [];

/** Copy the gate beside fixture bundles + baselines, run it, return its exit status and output. */
function runGate(bundles: Record<string, Bundle>, untranslatedBaseline: Record<string, string[]> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'locale-gate-'));
  workdirs.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'src/locales'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'scripts/check-locale-parity.mjs'));
  writeFileSync(join(root, 'scripts/locale-placeholder-baseline.json'), '[]\n');
  writeFileSync(join(root, 'scripts/locale-untranslated-baseline.json'), `${JSON.stringify(untranslatedBaseline)}\n`);
  for (const [name, bundle] of Object.entries(bundles)) {
    writeFileSync(join(root, `src/locales/${name}.json`), `${JSON.stringify(bundle, null, 2)}\n`);
  }
  const run = spawnSync(process.execPath, [join(root, 'scripts/check-locale-parity.mjs')], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

const EN: Bundle = {
  save: 'Save',
  'cashier.pending': 'Pending',
  cashier: { zreport: { total_tips: 'Tips', order_type: 'Type' } },
};

afterAll(() => {
  for (const dir of workdirs) rmSync(dir, { recursive: true, force: true });
});

describe('locale gate — untranslated values', () => {
  it('fails when a NESTED value is the English string verbatim', () => {
    const { status, output } = runGate({
      en: EN,
      de: {
        save: 'Speichern',
        'cashier.pending': 'Ausstehend',
        cashier: { zreport: { total_tips: 'Tips', order_type: 'Typ' } },
      },
    });

    expect(status).toBe(1);
    // Reported under its dotted path, with the English value shown — indexing `en[key]` printed
    // `undefined` for nested keys, naming the key while hiding the string.
    expect(output).toContain('untranslated: cashier.zreport.total_tips = "Tips"');
  });

  it('passes when every nested value is translated', () => {
    const { status, output } = runGate({
      en: EN,
      de: {
        save: 'Speichern',
        'cashier.pending': 'Ausstehend',
        cashier: { zreport: { total_tips: 'Trinkgeld', order_type: 'Typ' } },
      },
    });

    expect(status).toBe(0);
    expect(output).toContain('no new untranslated values');
  });

  it('accepts a nested match recorded in the baseline under the same dotted path', () => {
    const { status } = runGate(
      {
        en: EN,
        de: {
          save: 'Speichern',
          'cashier.pending': 'Ausstehend',
          cashier: { zreport: { total_tips: 'Trinkgeld', order_type: 'Type' } },
        },
      },
      { 'de.json': ['cashier.zreport.order_type'] },
    );

    expect(status).toBe(0);
  });

  it('still fails on a TOP-LEVEL untranslated value, in the key shape the baseline already stores', () => {
    const { status, output } = runGate({
      en: EN,
      de: {
        save: 'Save',
        'cashier.pending': 'Ausstehend',
        cashier: { zreport: { total_tips: 'Trinkgeld', order_type: 'Typ' } },
      },
    });

    expect(status).toBe(1);
    expect(output).toContain('untranslated: save = "Save"');
  });

  it('does not flag a translated key that a locale NESTS while en.json keeps it flat', () => {
    // `es` and `tr` really do this with five `cashier.*` keys. Values are resolved the way i18next
    // resolves them — nested path first, then the literal flat key — so both spellings compare
    // against the English string rather than against `undefined`.
    const { status, output } = runGate({
      en: EN,
      de: {
        save: 'Speichern',
        cashier: { pending: 'Ausstehend', zreport: { total_tips: 'Trinkgeld', order_type: 'Typ' } },
      },
    });

    expect(status).toBe(0);
    expect(output).toContain('no new untranslated values');
  });

  it('the shipped baseline records nested keys, so the real bundles are covered', () => {
    const baseline: Record<string, string[]> = JSON.parse(readFileSync(SHIPPED_BASELINE, 'utf8'));
    const nested = Object.values(baseline)
      .flat()
      .filter((key) => key.startsWith('cashier.zreport.'));

    // Pre-fix the walk never descended, so no `cashier.zreport.*` path could ever be banked.
    expect(nested.length).toBeGreaterThan(0);
  });
});

/**
 * Plural KEY FAMILIES (#590).
 *
 * The first version of the key-parity block compared byte-identical key SETS against `en.json`, so
 * a correct i18next plural was a failure BY CONSTRUCTION: `ar` needs six categories and `zh` one,
 * and every category `en` does not have reads as `extra` while every `en` category the locale must
 * not have reads as `missing`. Three merged PRs (#569, #582, #589) each independently rewrote a
 * counted sentence into a label-plus-number to get past it, so the gate was shaping the product's
 * copy rather than protecting it.
 *
 * The required categories come from `Intl.PluralRules`, which is also what i18next itself uses to
 * pick a suffix at runtime — so the gate demands exactly the keys the renderer will look up. Note
 * this makes the gate STRICTER for `ar`/`ru`/`fr`, which must now SUPPLY their extra forms.
 */
describe('locale gate — plural key families', () => {
  const EN_PLURAL: Bundle = {
    save: 'Save',
    items_one: '{{count}} item',
    items_other: '{{count}} items',
  };

  /** Every category `Intl.PluralRules` gives the locale, so a family is complete by construction. */
  const family = (locale: string, render: (category: string) => string): Bundle =>
    Object.fromEntries(
      new Intl.PluralRules(locale).resolvedOptions().pluralCategories.map((c) => [`items_${c}`, render(c)]),
    );

  it('accepts a CORRECT family: 6 Arabic forms, 4 Russian, 2 Turkish, 1 Chinese', () => {
    const { status, output } = runGate({
      en: EN_PLURAL,
      ar: { save: 'حفظ', ...family('ar', (c) => `{{count}} عنصر ${c}`) },
      ru: { save: 'Сохранить', ...family('ru', (c) => `{{count}} предмет ${c}`) },
      tr: { save: 'Kaydet', ...family('tr', (c) => `{{count}} ürün ${c}`) },
      zh: { save: '保存', ...family('zh', (c) => `{{count}} 件 ${c}`) },
    });

    expect(status).toBe(0);
    expect(output).toContain('locale parity holds');
  });

  it('fails when Russian omits the _many form its CLDR rules require', () => {
    const ru = family('ru', (c) => `{{count}} предмет ${c}`);
    delete ru.items_many;
    const { status, output } = runGate({ en: EN_PLURAL, ru: { save: 'Сохранить', ...ru } });

    expect(status).toBe(1);
    expect(output).toContain('missing: items_many');
  });

  it('fails when Arabic omits the _two form its CLDR rules require', () => {
    const ar = family('ar', (c) => `{{count}} عنصر ${c}`);
    delete ar.items_two;
    const { status, output } = runGate({ en: EN_PLURAL, ar: { save: 'حفظ', ...ar } });

    expect(status).toBe(1);
    expect(output).toContain('missing: items_two');
  });

  it('fails on a category the locale does NOT have — Turkish has no _few', () => {
    const { status, output } = runGate({
      en: EN_PLURAL,
      tr: { save: 'Kaydet', ...family('tr', (c) => `{{count}} ürün ${c}`), items_few: 'birkaç ürün' },
    });

    expect(status).toBe(1);
    expect(output).toContain('extra:   items_few');
  });

  it('fails when en.json itself carries a category English does not have', () => {
    const { status, output } = runGate({
      en: { ...EN_PLURAL, items_few: 'a few items' },
      tr: { save: 'Kaydet', ...family('tr', (c) => `{{count}} ürün ${c}`) },
    });

    expect(status).toBe(1);
    expect(output).toContain('en.json');
    expect(output).toContain('items_few');
  });

  it('leaves an ORDINARY key that merely ends in a plural suffix alone', () => {
    // `discount_value_must_be_greater_than_zero` is real, and has no `_other` sibling — so it is
    // not a family and every locale must carry it verbatim, exactly as before.
    const en: Bundle = { save: 'Save', discount_must_be_greater_than_zero: 'Must be greater than zero' };

    expect(runGate({ en, de: { save: 'Speichern' } }).status).toBe(1);
    expect(
      runGate({ en, de: { save: 'Speichern', discount_must_be_greater_than_zero: 'Muss größer als null sein' } })
        .status,
    ).toBe(0);
  });

  it('still fails on a plain missing key while a family is present (the loosening is bounded)', () => {
    const { status, output } = runGate({
      en: EN_PLURAL,
      ar: family('ar', (c) => `{{count}} عنصر ${c}`), // `save` dropped
    });

    expect(status).toBe(1);
    expect(output).toContain('missing: save');
  });

  it('checks a plural category value against the English _other for placeholders', () => {
    const ru = family('ru', (c) => `{{count}} предмет ${c}`);
    ru.items_many = 'много предметов'; // `{{count}}` dropped — en has no `items_many` to compare to
    const { status, output } = runGate({ en: EN_PLURAL, ru: { save: 'Сохранить', ...ru } });

    expect(status).toBe(1);
    expect(output).toContain('ru.json:items_many');
  });

  it('checks a plural category value against the English _other for untranslated text', () => {
    const ar = family('ar', (c) => `{{count}} عنصر ${c}`);
    ar.items_few = '{{count}} items'; // the English `items_other` string, verbatim
    const { status, output } = runGate({ en: EN_PLURAL, ar: { save: 'حفظ', ...ar } });

    expect(status).toBe(1);
    expect(output).toContain('untranslated: items_few');
  });
});
