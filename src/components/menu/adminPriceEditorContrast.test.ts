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

/** Token values for one theme block, so light and dark are read from the real file, not restated. */
function tokens(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`selector not found in colors.css: ${selector}`);
  const block = CSS.slice(start, CSS.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[name] = value;
  }
  return out;
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
     * The Chef's Special hero's "Add to Order" — the menu page's primary call to action, and the
     * same class of defect as the two above: it shipped at 2.78:1 in light and 2.01:1 in dark,
     * measured from the rendered pixels. The card's Add button had been moved to the darker tier
     * for AA long before; the hero was simply never brought along.
     *
     * BOTH halves of the pair are gated on purpose. Fixing only the background left it at 2.36:1
     * in dark, because `--feedback-success-darker` flips to a light green there while the hero's
     * hardcoded `white` did not flip with it — a half-flipped pair, which is invisible to any check
     * that looks at one token.
     *
     * Aliases: globals.css maps `--success-color-darker` → `--feedback-success-darker` and
     * `--button-text-color` → `--text-on-primary`.
     */
    it('the featured hero CTA clears AA in this theme', () => {
      expect(contrast(v['--text-on-primary'], v['--feedback-success-darker'])).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  // The regression this file was written for: assert the OLD pairings really do fail, so the gate
  // above is known to be measuring something rather than passing by construction.
  it('records that the original pairings failed in the light theme', () => {
    const v = tokens(':root {');
    expect(contrast(v['--text-muted'], v['--surface-secondary'])).toBeLessThan(AA_TEXT);
    expect(contrast(v['--feedback-error'], v['--surface-card'])).toBeLessThan(AA_TEXT);
  });

  // Same idea for the hero CTA: pin that BOTH of the pairings it used to have really do fail, so a
  // future retune cannot quietly restore one of them and leave the gate above passing by luck.
  it('records that the hero CTA failed on its old background, in BOTH themes', () => {
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
