import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * `scripts/check-locale-orphans.mjs` (#439), exercised as CI runs it.
 *
 * 581 of 2966 keys (19.6%) had no reference anywhere, and no gate could see them: parity compares
 * the ten bundles to EACH OTHER, so a key missing from all ten is perfectly consistent, and
 * `check-t-keys.mjs` reads callsites for a key that is ABSENT. Neither asks whether anything reads
 * a key that is present.
 *
 * Most of these cases are FAIL-OPEN modes — the gate stays green while the thing it exists to catch
 * walks past — and two of them were measured on the real tree during the survey, not imagined:
 *
 *   - 16 files hold a literal KEY TABLE and call `t(TABLE[x].key)`. A gate that scans for
 *     `t('literal')` reports all of them dead. Cost of getting it wrong: a live string deleted.
 *   - `scripts/*-baseline.json` are GENERATED FROM en.json, so they name the keys under test.
 *     Counting them as code marks 75 orphans as live. Cost of getting it wrong: the gate reports
 *     success on exactly the keys it exists to find.
 *
 * A fail-open mode leaves no trace when it regresses, so each one gets a fixture. The suite runs the
 * REAL script against a temp tree, the same way `localeUntranslatedGate.test.ts` does: the script
 * resolves its corpus relative to its own file, so copying it beside a fixture tree is enough and no
 * test-only hook has to exist in a production gate.
 */

const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-locale-orphans.mjs');

const workdirs: string[] = [];

/** Write `files` (path → contents) beside `en.json`, run the gate, return status + output. */
function runGate(englishKeys: Record<string, unknown>, files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'orphan-gate-'));
  workdirs.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'src/locales'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'scripts/check-locale-orphans.mjs'));
  writeFileSync(join(root, 'src/locales/en.json'), `${JSON.stringify(englishKeys, null, 2)}\n`);
  for (const [rel, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), contents);
  }
  const run = spawnSync(process.execPath, [join(root, 'scripts/check-locale-orphans.mjs')], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

afterAll(() => {
  for (const dir of workdirs) rmSync(dir, { recursive: true, force: true });
});

describe('orphan gate — the baseline behaviours', () => {
  it('passes when every key is read, and says how much it looked at', () => {
    const { status, output } = runGate(
      { save_now: 'Save' },
      { 'src/components/Save.tsx': "export const S = () => <b>{t('save_now')}</b>;\n" },
    );

    expect(status).toBe(0);
    expect(output).toContain('no orphaned locale keys');
  });

  it('fails on a key nothing reads, and names it', () => {
    const { status, output } = runGate(
      { save_now: 'Save', checkout_title_old: 'Checkout' },
      { 'src/components/Save.tsx': "export const S = () => <b>{t('save_now')}</b>;\n" },
    );

    expect(status).toBe(1);
    expect(output).toContain('orphan: checkout_title_old');
    expect(output).not.toContain('orphan: save_now');
  });

  it('reaches a NESTED key by its dotted path', () => {
    const { status, output } = runGate(
      { cashier: { zreport: { total_tips: 'Tips', dead_one: 'Gone' } } },
      { 'src/components/Z.tsx': "t('cashier.zreport.total_tips');\n" },
    );

    expect(status).toBe(1);
    expect(output).toContain('orphan: cashier.zreport.dead_one');
    expect(output).not.toContain('orphan: cashier.zreport.total_tips');
  });
});

describe('orphan gate — the fail-open modes, each measured on the real tree', () => {
  it('counts a key held in a literal KEY TABLE, where no literal sits at the callsite', () => {
    // `ORDER_STATUS_META`, `PAYMENT_STATUS_META`, `DAY_KEYS`, `libraryPickerCopy` … 16 of these.
    const { status, output } = runGate(
      // Deliberately NOT under a DYNAMIC_PREFIXES entry: `order_status_ready` would be accepted by
      // the prefix allowlist and the fixture would pass without ever exercising the table path.
      { menu_type_filter_all: 'All types' },
      {
        'src/lib/menuTypeFilter.ts':
          "export const LABELS = { all: { i18nKey: 'menu_type_filter_all' } };\n" +
          'export const label = (k, t) => t(LABELS[k].i18nKey);\n',
      },
    );

    expect(status).toBe(0);
    expect(output).toContain('no orphaned locale keys');
  });

  it('does NOT count a derived baseline as a reference', () => {
    // `scripts/*-baseline.json` are generated FROM en.json. Counting them marked 75 orphans live.
    const { status, output } = runGate(
      { dead_key_x: 'Dead' },
      { 'scripts/locale-untranslated-baseline.json': '{ "de.json": ["dead_key_x"] }\n' },
    );

    expect(status).toBe(1);
    expect(output).toContain('orphan: dead_key_x');
  });

  it('does not let the gate\u2019s OWN allowlist count as a reference', () => {
    // `scripts/` is in the corpus and this script names every allowlisted key, so without excluding
    // itself each one marks itself used and the warning below could never fire.
    const { status, output } = runGate({ german: 'German' });

    expect(status).toBe(0);
    expect(output).toContain('german');
    expect(output).toContain('allowlisted');
  });

  it('does not accept a LONGER key as a reference to the shorter one', () => {
    // 55 dead keys are a strict prefix of a live key (`all_categories` vs `all_categories_nav`).
    // A plain substring search calls every one of them alive.
    const { status, output } = runGate(
      { all_categories_nav: 'All', all_categories: 'All' },
      { 'src/app/page.tsx': "t('all_categories_nav');\n" },
    );

    expect(status).toBe(1);
    expect(output).toContain('orphan: all_categories');
    expect(output).not.toContain('orphan: all_categories_nav');
  });

  it('reads a key out of a template literal, which a token-per-line scan misses', () => {
    const { status } = runGate(
      { table_number_label_short: 'Table' },
      {
        'src/app/kitchen/page.tsx':
          'const h = `<b>${t(\u0027table_number_label_short\u0027, \u0027Table\u0027)}</b>`;\n',
      },
    );

    expect(status).toBe(0);
  });
});

describe('orphan gate — what it must never delete', () => {
  it('accepts a key composed at runtime from an allowlisted PREFIX', () => {
    const { status } = runGate(
      { allergen_gluten: 'Gluten', allergen_nuts: 'Nuts' },
      { 'src/components/A.tsx': 'const label = (a) => t(`allergen_${a}`);\n' },
    );

    expect(status).toBe(0);
  });

  it('still fails on a key whose prefix is NOT allowlisted — the loosening is bounded', () => {
    const { status, output } = runGate(
      { madeup_gluten: 'Gluten' },
      { 'src/components/A.tsx': 'const label = (a) => t(`madeup_${a}`);\n' },
    );

    expect(status).toBe(1);
    expect(output).toContain('orphan: madeup_gluten');
  });

  it('WARNS but does not fail on a key no static analysis can settle', () => {
    // `categoryNameMapper` lowercases a category name a TENANT typed into their database and uses
    // it as a key, so the truth for `salads` / `meze` / `seafood` lives in a production database.
    // A gate that fails here would be demanding a proof that cannot exist.
    const { status, output } = runGate({ salads: 'Salads', meze: 'Meze' });

    expect(status).toBe(0);
    expect(output).toContain('allowlisted, not failed on');
    expect(output).toContain('salads');
    expect(output).toContain('meze');
  });

  it('counts a key named only in a COMMENT — somebody wrote it down on purpose', () => {
    const { status } = runGate(
      { cashier_refresh_failed: 'Failed' },
      { 'src/lib/notes.ts': '// see cashier_refresh_failed for the flat-vs-nested trap\nexport const x = 1;\n' },
    );

    expect(status).toBe(0);
  });
});
