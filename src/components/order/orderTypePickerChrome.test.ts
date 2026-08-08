import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Gate for the order-type picker's chrome and for the Confirm button the order modals share
 * (MENU-DESIGN-CONFORMANCE-PLAN S4).
 *
 * Nothing else can see either of them. The screenshot baselines capture the picker with **no** type
 * chosen, so the selected segment has no committed frame at all — which is how a `#2e7d32` green
 * survived two redesign PRs on a page whose design system reserves red as the sole action colour and
 * prohibits green outright (`docs/stitch-screens/heritage_table/DESIGN.md` §Colors). The modals'
 * Confirm is behind a click the screenshot run never makes.
 *
 * Assertions are split deliberately: the RATIOS come from `colors.css`, and the CALL SITES come from
 * the two CSS Modules that ship. A gate that only measures token pairs stays green after someone
 * points the segment back at green; one that only reads the modules cannot tell whether the tokens
 * it names are legible.
 */

const TOKENS = join(__dirname, '../../design-system/tokens/colors.css');
const CSS = readFileSync(TOKENS, 'utf8');

/** Literal hex declarations in one theme block, plus one pass resolving same-block `var()` aliases. */
function tokens(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`selector not found in colors.css: ${selector}`);
  const block = CSS.slice(start, CSS.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[name] = value;
  }
  for (const [, name, target] of block.matchAll(/(--[\w-]+):\s*var\((--[\w-]+)\)\s*;/g)) {
    if (out[target]) out[name] = out[target];
  }
  return out;
}

/**
 * The declarations of one rule, comments stripped.
 *
 * Stripping matters here rather than being tidiness: these rules are commented with the names of the
 * declarations that were REMOVED (`text-overflow: ellipsis`, `outline: none`), so an unstripped read
 * finds the prose explaining the fix and reports the defect as still present.
 */
function block(file: string, selector: string): string {
  const css = readFileSync(join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`selector not found in ${file}: ${selector}`);
  const end = css.indexOf('\n}', start);
  if (end === -1) throw new Error(`unterminated rule in ${file}: ${selector}`);
  return css.slice(start, end);
}

/**
 * Every rule in a module as `{ selectors, body }`, comments stripped.
 *
 * `block()` cannot be used for the focus assertions: it anchors on `\n<selector> {`, and
 * `.button:focus-visible` appears FIRST as the second line of the `.button:hover,
 * .button:focus-visible` pair, so it would return the hover rule's body. The declaration has to be
 * tied to the rule that carries it, which means reading the rules rather than the file.
 */
function rules(file: string): { selectors: string; body: string }[] {
  const css = readFileSync(join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/(?:^|\n)([^{}@][^{}]*?)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: selectors.trim(),
    body: body.trim(),
  }));
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const n = parseInt(full.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 0xff) + 0.7152 * channel((n >> 8) & 0xff) + 0.0722 * channel(n & 0xff);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
/** WCAG 1.4.11 / 2.4.11: a focus ring is not text and clears at 3:1. */
const AA_NON_TEXT = 3;

const THEMES = [
  ['light', ':root {'],
  ['dark', "html[data-theme='dark'] {"],
] as const;

describe('order-type picker chrome', () => {
  describe.each(THEMES)('%s theme', (_theme, selector) => {
    const v = tokens(selector);

    it('the selected segment label clears AA on its brand fill', () => {
      expect(contrast(v['--text-on-primary'], v['--brand-primary'])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    /**
     * The ring sits on the group's own `--card-background`, which aliases `--surface-card` — NOT on
     * the segment it outlines. That is what `outline-offset: 2px` buys: on the selected segment the
     * ring would otherwise be brand-on-brand and invisible.
     */
    it('the focus ring is perceivable against the group surface', () => {
      expect(contrast(v['--brand-primary'], v['--surface-card'])).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });

  /**
   * Fires the pairing that shipped, so the fix is known to be measuring something.
   *
   * The light reading (`#ffffff` on `#2e7d32`) passes at 5.13:1, which is exactly why this lasted:
   * the defect is only a contrast failure in the DARK theme, where `--feedback-success-darker` lifts
   * to `#66bb6a` while `--text-on-accent` stays white in both themes — 2.36:1. So the green was
   * simultaneously a design-system violation everywhere and an AA failure in half the app, and
   * neither the screenshots nor the axe pass could reach the state that showed it.
   */
  it('records that the retired green segment failed AA in the DARK theme', () => {
    const dark = tokens("html[data-theme='dark'] {");
    const light = tokens(':root {');

    // `--text-on-accent` is white in BOTH themes — that is the half of the pair that never flipped.
    expect(light['--text-on-accent']).toBe('#ffffff');
    expect(dark['--text-on-accent']).toBeUndefined();

    expect(contrast('#ffffff', dark['--feedback-success-darker'])).toBeLessThan(AA_TEXT);
  });

  /**
   * The fact that makes the fallbacks the thing classic actually renders, and the reason the green
   * was invisible to anyone reading the rule: `--modal-body-confirm-bg` is written as a craft hook,
   * so it reads like a value someone chose. It is declared in exactly ONE file — craft's — which
   * means classic has always taken whatever literal sits in the `var()` fallback slot.
   *
   * If a second declaration ever appears (a shared default, a third template), the fallbacks below
   * stop being what classic paints and every assertion in this file quietly stops describing the
   * shipped page. Hence an exhaustive tree search rather than a spot check.
   */
  it('is a craft-only hook, so classic renders the fallback', () => {
    // grep exits 1 on zero matches, which `execFileSync` raises as an exception — so the case this
    // test exists to catch (the declaration REMOVED) would crash with a shell error instead of
    // reporting a diff. It still fails, i.e. the gate is closed either way, but "Command failed:
    // grep -rl …" tells the next reader nothing. Map it to no matches and let `toEqual` speak.
    let found = '';
    try {
      found = execFileSync(
        'grep',
        ['-rl', '--include=*.css', '--', '--modal-body-confirm-bg:', join(__dirname, '../..')],
        {
          encoding: 'utf8',
        },
      );
    } catch (error) {
      if ((error as { status?: number }).status !== 1) throw error;
    }

    const declarations = found
      .split('\n')
      .filter(Boolean)
      .map((p) => p.replace(/^.*\/src\//, 'src/'));

    expect(declarations).toEqual(['src/templates/craft/tokens.css']);
  });

  /**
   * Binds the ratios above to the declarations that ship.
   *
   * The foreground has to move with the background and that is the half most likely to be "tidied"
   * back: `--text-on-accent` looks like the right neighbour for an accent fill, and it is white in
   * both themes, so restoring it re-creates the 2.36:1 the case above fires.
   */
  it.each([
    ['OrderTypeToggle.module.css', '.button.active'],
    ['TableSelectionModal.module.css', '.primaryButton'],
  ])('%s %s takes the brand, with the foreground that flips', (file, selector) => {
    const rule = block(file, selector);

    expect(rule).toContain('var(--modal-body-confirm-bg, var(--brand-primary))');
    expect(rule).toContain('var(--modal-body-confirm-fg, var(--text-on-primary))');
    expect(rule).not.toContain('--success-color-darker');
    expect(rule).not.toContain('--text-on-accent');
  });

  /**
   * The label is not truncated in any locale.
   *
   * At the 360px rail each segment is ~96px wide, which left the label ~60px beside the icon against
   * the 66px English "Takeaway" needs — it rendered "Takea…". No padding tweak fixes that, because
   * every other locale is longer ("Zum Mitnehmen", "Comer en el restaurante"), and the baselines only
   * ever shoot English. Stacking is what gives the label the segment's full width.
   *
   * `flex-direction: column` rather than `flex-wrap: wrap`, which was the first attempt: wrapping is
   * decided per segment, so English rendered Takeaway stacked between two inline neighbours and WHICH
   * segments stacked changed with the locale.
   */
  it('gives the label the full segment width instead of clipping it', () => {
    const button = block('OrderTypeToggle.module.css', '.button');
    const label = block('OrderTypeToggle.module.css', '.label');

    expect(button).toContain('flex-direction: column');
    expect(label).not.toContain('text-overflow');
    expect(label).not.toContain('white-space: nowrap');
    // Last-resort guard for a locale whose single word is wider than the whole segment.
    expect(label).toContain('overflow-wrap: break-word');
  });

  /**
   * The selected segment had NO focus indicator, and the cause is a specificity tie rather than a
   * missing rule: `.button:focus-visible` is (0,2,0), the same as `.button.active`, which is declared
   * later and therefore won the background. Keyboard-focusing the selected segment left it
   * byte-identical to its resting state, with `outline: none` on top. Verified by tabbing to it.
   *
   * So the fix cannot be "give focus a background" — it has to be an outline, and the `outline: none`
   * that shipped alongside the hover tint has to be gone. Both are asserted, in both files: the four
   * order modals that share `.primaryButton` had the same hole, with a 1px `translateY` as the entire
   * focus affordance (and nothing at all under `prefers-reduced-motion`).
   *
   * The ring is asserted against the RULE that declares it, not against the file. A file-wide
   * `expect(css).toMatch(/:focus-visible[\s\S]*?outline: 2px solid …/)` reads as if it binds the two,
   * and does not: `[\s\S]*?` is unbounded, so the left half is satisfied forever by the pre-existing
   * `.button:hover, .button:focus-visible` pair further up, and the right half by the declaration
   * wherever it lands. Renaming `.button:focus-visible` to `.skeleton-decoy` — i.e. deleting the whole
   * fix — left that version green in both files. Caught in review; recorded so it is not rewritten
   * that way.
   *
   * The `outline: none` half is asserted only on rules that reach an INTERACTIVE control.
   * `TableSelectionModal.module.css` keeps one deliberate `.tablePicker:focus { outline: none }`, and
   * it is not the same thing: that div is `tabIndex={-1}` and focused only programmatically, to land a
   * screen reader on the picker after "you still need a table". Tab never reaches it, so there is no
   * keyboard focus to indicate. A file-wide assertion failed on exactly that rule on its first run.
   */
  it.each(['OrderTypeToggle.module.css', 'TableSelectionModal.module.css'])(
    '%s gives keyboard focus a real outline',
    (file) => {
      const all = rules(file);
      const focusRules = all.filter((r) => r.selectors.includes(':focus-visible'));
      expect(focusRules.length).toBeGreaterThan(0);

      // At least one focus rule draws the ring — and it is a focus rule, not just some rule.
      const ringed = focusRules.filter(
        (r) => /outline:\s*2px solid var\(--brand-primary\)/.test(r.body) && r.body.includes('outline-offset: 2px'),
      );
      expect(ringed.map((r) => r.selectors)).not.toEqual([]);

      // …and no control rule takes it away again.
      const controlRules = all.filter((r) => /:hover|:focus-visible/.test(r.selectors));
      expect(controlRules.length).toBeGreaterThan(0);
      for (const r of controlRules) {
        expect(`${r.selectors} => ${r.body}`).not.toContain('outline: none');
      }
    },
  );
});
