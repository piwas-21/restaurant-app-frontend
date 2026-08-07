import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contrast gate for `AdminPriceEditor`'s two new text surfaces, and for the featured hero's CTA.
 *
 * It exists because both of them shipped failing when measured. The locked-reason pill used
 * `--text-muted` on `--surface-secondary` (**4.24:1** in light) and the save-error line used
 * `--feedback-error` on `--surface-card` (**3.50:1** in light) — and the dark theme hid both, at
 * 5.5 and 6.71. Reading the dark screenshot, or reasoning about the token names, would have called
 * them fine; only measuring the light pair found them.
 *
 * `presets.test.ts` gates the tenant PALETTE pairs. These four tokens are not palette variables —
 * they come from `design-system/tokens/colors.css` and no palette repaints them — so that suite
 * cannot see this pairing. Hence a separate, narrow gate rather than a widened one.
 */

const CSS = readFileSync(join(__dirname, '../../design-system/tokens/colors.css'), 'utf8');

/**
 * Token values for one theme block, so light and dark are read from the real file, not restated.
 *
 * Literal hex first, then ONE pass resolving `--a: var(--b)` aliases within the same block.
 * `--brand-primary-elevated` is exactly that in the light block (`var(--brand-primary-dark)`) and a
 * literal in dark, so a hex-only reader returns `undefined` for light and every pairing that uses
 * it fails as NaN — which is what this helper did on the first run. Only one level is resolved on
 * purpose: a chain would mean the token layer had grown an indirection worth reading properly
 * rather than pattern-matching, and this should break loudly if that happens.
 */
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
 * The `color:` declaration of one rule in one component's CSS Module.
 *
 * The pairing assertions below measure two token NAMES against each other, which proves the pair is
 * legible but not that any element uses it — a gate that would still be green after someone pointed
 * the price back at green. These readers close that: they bind the assertion to the declaration
 * that actually ships, so reverting the CSS turns this file red. Proven by doing it: all three
 * cases fail with the old token names in `Received`.
 */
function ruleColor(modulePath: string, selector: string): string {
  const css = readFileSync(join(__dirname, modulePath), 'utf8');
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`selector not found in ${modulePath}: ${selector}`);
  const block = css.slice(start, css.indexOf('\n}', start));
  const match = /(?:^|\n)\s{2}color:\s*([^;]+);/.exec(block);
  if (!match) throw new Error(`no color declaration in ${modulePath} ${selector}`);
  return match[1].trim();
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
/** WCAG 1.4.11: a UI boundary is not text and clears at 3:1. */
const AA_NON_TEXT = 3;

const THEMES = [
  ['light', ':root {'],
  ['dark', "html[data-theme='dark'] {"],
] as const;

describe('AdminPriceEditor colour pairs', () => {
  describe.each(THEMES)('%s theme', (_theme, selector) => {
    const v = tokens(selector);

    it('the locked-reason pill clears AA', () => {
      // Was --text-muted, which fails at 4.24 in light.
      expect(contrast(v['--text-secondary'], v['--surface-secondary'])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('the save-error line clears AA', () => {
      // Was --feedback-error, which fails at 3.50 in light — it is tuned as a border/icon hue.
      expect(contrast(v['--feedback-danger-dark'], v['--surface-card'])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('the invalid-input border clears the non-text threshold', () => {
      expect(contrast(v['--feedback-error'], v['--surface-card'])).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    /**
     * The menu page's primary call to action — the card's "Add to Order" and the Chef's Special
     * strip's, which are now the same pairing.
     *
     * It used to be GREEN (`--feedback-success-darker`), on a page whose brand is red and whose
     * featured panel was gold: three unrelated accent families, which is most of why the page read
     * as assembled rather than designed. The redesign makes the brand the sole action colour
     * (docs/stitch-screens/heritage_table/DESIGN.md), so this gate follows the CTA to its new
     * background instead of continuing to measure a token no button uses — a gate left pointing at
     * a retired pairing passes without testing anything.
     */
    it('the primary CTA clears AA in this theme', () => {
      expect(contrast(v['--text-on-primary'], v['--brand-primary'])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    /**
     * The hover/press background of that same button. Gated because the obvious choice is broken:
     * `--brand-primary-dark` is declared only on `:root`, so it does NOT flip, and pairing it with
     * the dark theme's dark ink is 1.72:1 — the half-flipped pair this file's header describes,
     * invisible to any check that reads one token. `--brand-primary-hover` exists to have a value
     * in both blocks; the `records that` case below fires the broken one to prove it.
     */
    it('the CTA hover background clears AA in this theme', () => {
      expect(contrast(v['--text-on-primary'], v['--brand-primary-hover'])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    /**
     * The card's Details link, its mobile row price, the featured strip's price and the admin
     * price trigger — all small brand-coloured TEXT, and all sitting on whichever of three surfaces
     * the card currently has: resting, hovered (`--surface-secondary-light`) and blocked
     * (`--surface-secondary`).
     *
     * All three are gated, because the resting one alone is not the risk. Measured on
     * `--brand-primary`: 4.57:1 resting in dark (a pass, by 0.07), but 3.23:1 hovered and 4.16:1
     * blocked — i.e. hovering any card in dark mode dropped its Details link under AA, and every
     * blocked card was under it at rest. Gating only the surface the element sits on *most* of the
     * time is the same mistake as reading only the dark screenshot.
     *
     * `--brand-primary-elevated` is the token for this — "the brand as small text on an elevated /
     * tinted surface" — and clears all three in both themes.
     */
    it.each(['--surface-card', '--surface-secondary-light', '--surface-secondary'])(
      'brand-coloured card text clears AA on %s in this theme',
      (surface) => {
        expect(contrast(v['--brand-primary-elevated'], v[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      },
    );

    /**
     * The item customization sheet's money.
     *
     * Three prices live one tap from every dish, and all three were failing when measured:
     *   - the ingredient surcharge was `--feedback-success` — 2.55:1 on the resting row and
     *     2.47:1 once the row turned `--feedback-success-xlight`. It is now ink.
     *   - the suggested side's price and the variation's price were the plain `--brand-primary` on
     *     the same tinted rows: 3.23:1 and 4.16:1 in dark. Both are now `-elevated`, the token the
     *     block above already establishes for brand-coloured text on a surface off the paper.
     *
     * Gated at unit level because nothing else can see them. The sheet only exists after a click,
     * and neither `customer-routes.screen.ts` nor the axe pass in `menu-and-cart.e2e.ts` ever opens
     * it — so the screenshot gate and the accessibility gate are both structurally blind here. A
     * green price could sit on the menu page's second screen indefinitely, which is exactly what
     * happened through two redesign PRs.
     *
     * Both row fills are gated, not just the resting one: an ingredient row shifts to
     * `--surface-secondary` when ticked, and a variation shifts to it when selected.
     */
    it.each(['--surface-secondary-light', '--surface-secondary'])(
      'the item sheet ingredient price clears AA on %s in this theme',
      (surface) => {
        expect(contrast(v['--text-primary'], v[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      },
    );

    it.each(['--surface-secondary-light', '--surface-secondary', '--surface-card'])(
      'the item sheet side/variation price clears AA on %s in this theme',
      (surface) => {
        expect(contrast(v['--brand-primary-elevated'], v[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      },
    );

    /**
     * The card's closing hairline. `--border-extra-light` is declared only on `:root` with no dark
     * override, so using it here painted #f0f0f0 over the #252525 dark card — a 13:1 white rule
     * across the bottom of every card. `--border-default` flips, and is the pair DESIGN.md
     * specifies. 3:1 is the non-text threshold; a divider only has to be perceivable, and this one
     * deliberately sits near the floor so it reads as a hairline rather than a box edge.
     */
    it('the card hairline is a token that exists in this theme', () => {
      expect(v['--border-default']).toBeDefined();
      expect(contrast(v['--border-default'], v['--surface-card'])).toBeLessThan(AA_NON_TEXT);
    });
  });

  // The regression this file was written for: assert the OLD pairings really do fail, so the gate
  // above is known to be measuring something rather than passing by construction.
  it('records that the original pairings failed in the light theme', () => {
    const v = tokens(':root {');
    expect(contrast(v['--text-muted'], v['--surface-secondary'])).toBeLessThan(AA_TEXT);
    expect(contrast(v['--feedback-error'], v['--surface-card'])).toBeLessThan(AA_TEXT);
  });

  /**
   * Fires the pairing the CTA hover would have had if it had reused `--brand-primary-dark`, which
   * is the natural reach: it is the light theme's pressed shade and it is right there. It is
   * declared ONLY on `:root`, so in the dark theme it keeps #890303 while `--text-on-primary` has
   * flipped to dark ink — 1.72:1. This is why `--brand-primary-hover` was added rather than the
   * existing token reused, and it fails loudly if someone "simplifies" that away.
   */
  it('records that reusing --brand-primary-dark for hover would fail in the DARK theme', () => {
    const light = tokens(':root {');
    const dark = tokens("html[data-theme='dark'] {");
    // The dark block does not redeclare it, so the light value is what would apply.
    expect(dark['--brand-primary-dark']).toBeUndefined();
    expect(contrast(dark['--text-on-primary'], light['--brand-primary-dark'])).toBeLessThan(AA_TEXT);
  });

  /**
   * Fires the two pairings that were actually shipped and then caught in review, so neither can
   * come back by looking reasonable:
   *   - the plain brand as card text, which fails on the hovered and blocked card surfaces in dark;
   *   - `--border-extra-light` as the card hairline, which has no dark value at all and therefore
   *     keeps its light one over a dark card.
   */
  it('records that the plain brand and the extra-light border failed in the DARK theme', () => {
    const dark = tokens("html[data-theme='dark'] {");
    expect(contrast(dark['--brand-primary'], dark['--surface-secondary-light'])).toBeLessThan(AA_TEXT);
    expect(contrast(dark['--brand-primary'], dark['--surface-secondary'])).toBeLessThan(AA_TEXT);

    // Not redeclared for dark — that is the whole defect.
    expect(dark['--border-extra-light']).toBeUndefined();
    const light = tokens(':root {');
    expect(contrast(light['--border-extra-light'], dark['--surface-card'])).toBeGreaterThan(10);
  });

  /**
   * Binds the pairing assertions above to the CSS that ships.
   *
   * Each of these three prices is one `color:` declaration on a surface no e2e gate opens, so the
   * only thing standing between them and a repeat of the green is this file. Asserting the token
   * NAME (rather than re-measuring) is deliberate: the ratios are already gated per-theme above, so
   * what is left to prove is that the sheet still reaches for the token that was measured.
   */
  it.each([
    ['customization/OptionalIngredientsSection.module.css', '.ingredientPrice', 'var(--text-primary)'],
    ['customization/SuggestedSideItemsSection.module.css', '.sideItemPrice', 'var(--brand-primary-elevated)'],
    ['customization/VariationsSection.module.css', '.variationPrice', 'var(--brand-primary-elevated)'],
    // `BundleOptionRow` renders INSIDE this same sheet — ItemCustomizationSheet -> BundleSheetBody ->
    // BundleSectionSelector -> here — and its rows sit on `--surface-secondary` (`.row.selected`, and
    // `.panel` for the whole expansion), the surface where plain `--brand-primary` is 4.16:1 in dark.
    // Both of these were on the plain brand until this slice.
    ['customization/BundleOptionRow.module.css', '.price', 'var(--brand-primary-elevated)'],
    ['customization/BundleOptionRow.module.css', '.customizeButton', 'var(--brand-primary-elevated)'],
  ])('%s %s uses the token this file measured', (modulePath, selector, expected) => {
    expect(ruleColor(modulePath, selector)).toBe(expected);
  });

  /**
   * Fires the item sheet's retired green surcharge, on every background it ever had.
   *
   * `--feedback-success-xlight` (the ticked row) and `--feedback-success-dark` (its dark twin) are
   * declared only on `:root`, so the dark theme inherited the LIGHT fill under its own lifted
   * green — which is why the worst reading of the four, 2.05:1, is the dark one. Reasoning from
   * the token names would have called a *-dark background under a light-green label safe.
   */
  it('records that the item sheet surcharge failed as green, on every fill it had', () => {
    const light = tokens(':root {');
    const dark = tokens("html[data-theme='dark'] {");

    // Light: on the resting row (2.55:1) and on the ticked row (2.47:1).
    expect(contrast(light['--feedback-success'], light['--surface-secondary-light'])).toBeLessThan(AA_TEXT);
    expect(contrast(light['--feedback-success'], light['--feedback-success-xlight'])).toBeLessThan(AA_TEXT);

    // Neither fill is redeclared for dark — that is what makes the dark reading the worst one.
    expect(dark['--feedback-success-xlight']).toBeUndefined();
    expect(dark['--feedback-success-dark']).toBeUndefined();
    expect(contrast(dark['--feedback-success'], light['--feedback-success-dark'])).toBeLessThan(AA_TEXT);
  });

  // The retired GREEN CTA tier. Kept because it records why the button is not green: both pairings
  // it ever had really do fail, so nobody re-derives that choice from the token names alone.
  it('records that the retired green CTA failed on its old background, in BOTH themes', () => {
    // Literal `#ffffff`, not `--text-on-primary`, because a hardcoded `white` is exactly what the
    // hero had — the token would have flipped to dark ink in the dark theme and PASSED there (8.65),
    // which is the whole reason the bug survived: it is only visible if you keep the ink fixed while
    // the surface flips.
    for (const [, selector] of THEMES) {
      const v = tokens(selector);
      expect(contrast('#ffffff', v['--feedback-success'])).toBeLessThan(AA_TEXT);
    }
  });

  it('records that fixing only the background left the DARK theme still failing', () => {
    const v = tokens("html[data-theme='dark'] {");
    // #ffffff on #66bb6a — the half-flipped pair, 2.36:1.
    expect(contrast('#ffffff', v['--feedback-success-darker'])).toBeLessThan(AA_TEXT);
  });
});
