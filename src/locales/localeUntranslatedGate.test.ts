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
