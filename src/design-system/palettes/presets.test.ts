import { PALETTES, getPalette, paletteToCss } from './index';
import type { Palette, PaletteVars } from './types';

// WCAG 2.x relative luminance + contrast ratio for #rrggbb.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA = 4.5;

// The pairs that must clear AA for a preset to be safe under any template:
// body/secondary/muted text on both surfaces, the brand fill as a button
// (on-primary text over it), and the brand as a link on paper.
const PAIRS: Array<[keyof PaletteVars, keyof PaletteVars]> = [
  ['text-primary', 'surface-primary'],
  ['text-primary', 'surface-card'],
  ['text-secondary', 'surface-primary'],
  ['text-muted', 'surface-primary'],
  ['text-on-primary', 'brand-primary'],
  ['link-default', 'surface-primary'],
];

/**
 * Composite a 5%-opacity black (light) or white (dark) wash over an opaque colour, the
 * way the browser paints `.nav-link.active`'s `--nav-link-active-bg` over the header.
 *
 * This exists because the pill's background is NOT a token — it is a translucent
 * overlay, so no `[fg, bg]` pair in PAIRS can express it, and the pill was the one
 * surface in the design system whose contrast nothing checked. It shipped failing on
 * three of five presets. The model is not theoretical: it reproduces axe's own reported
 * background (`#373737` over `#2c2c2c`, `#ded5c8` over `#eae0d2`) and its ratios (3.54
 * and 3.89) exactly, measured on the deployed classic and craft tenants.
 */
function washed(surface: string, mode: 'light' | 'dark'): string {
  const n = parseInt(surface.replace('#', ''), 16);
  const mix = (c: number) => Math.round(mode === 'dark' ? c + 0.05 * (255 - c) : c * 0.95);
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map(mix);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function assertAA(v: PaletteVars, label: string, mode: 'light' | 'dark'): void {
  const pairs = PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrast(v[fg], v[bg]) }));
  // The nav pill: brand-primary-elevated over the washed header surface.
  pairs.push({
    fg: 'brand-primary-elevated',
    bg: 'surface-secondary (5% washed)' as keyof PaletteVars,
    ratio: contrast(v['brand-primary-elevated'], washed(v['surface-secondary'], mode)),
  });
  const failures = pairs
    .filter((r) => r.ratio < AA)
    .map((r) => `${label}: ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)} (< ${AA})`);
  expect(failures).toEqual([]);
}

describe('palette presets (ADR-007)', () => {
  it.each(PALETTES.map((p) => [p.key, p] as [string, Palette]))(
    '%s clears WCAG AA for text/surface + brand pairs, light and dark',
    (_key, p) => {
      assertAA(p.light, `${p.key} light`, 'light');
      assertAA(p.dark, `${p.key} dark`, 'dark');
    },
  );

  it('every preset defines the same full token set in both modes', () => {
    for (const p of PALETTES) {
      expect(Object.keys(p.light).sort()).toEqual(Object.keys(p.dark).sort());
      // 18 since brand-primary-elevated joined the contract (was 17). This count is the
      // tripwire for a token being added to SemanticColorName but not emitted by vars() —
      // paletteToCss would then silently drop it and every palette would fall back to the
      // template's baked value for that one token, which is how the nav pill broke.
      expect(Object.keys(p.light)).toHaveLength(18);
    }
  });

  it('keys are unique', () => {
    const keys = PALETTES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('swatch matches the light brand-primary (picker chip = the brand)', () => {
    for (const p of PALETTES) {
      expect(p.swatch).toBe(p.light['brand-primary']);
    }
  });

  it('getPalette resolves a known key and rejects null/unknown', () => {
    expect(getPalette('terracotta')?.key).toBe('terracotta');
    expect(getPalette(null)).toBeUndefined();
    expect(getPalette('does-not-exist')).toBeUndefined();
  });

  it('paletteToCss is the safe default (empty) for null/unknown keys', () => {
    expect(paletteToCss(null)).toBe('');
    expect(paletteToCss(undefined)).toBe('');
    expect(paletteToCss('does-not-exist')).toBe('');
  });

  it('paletteToCss emits doubled-specificity light + dark blocks for a known key', () => {
    const css = paletteToCss('terracotta');
    expect(css).toContain(':root:root{');
    expect(css).toContain("html[data-theme='dark']:root{");
    expect(css).toContain('--brand-primary:#a84b2f');
    expect(css).toContain('--surface-primary:#fff9f2');
  });
});
