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

function assertAA(v: PaletteVars, label: string): void {
  const failures = PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrast(v[fg], v[bg]) }))
    .filter((r) => r.ratio < AA)
    .map((r) => `${label}: ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)} (< ${AA})`);
  expect(failures).toEqual([]);
}

describe('palette presets (ADR-007)', () => {
  it.each(PALETTES.map((p) => [p.key, p] as [string, Palette]))(
    '%s clears WCAG AA for text/surface + brand pairs, light and dark',
    (_key, p) => {
      assertAA(p.light, `${p.key} light`);
      assertAA(p.dark, `${p.key} dark`);
    },
  );

  it('every preset defines the same full token set in both modes', () => {
    for (const p of PALETTES) {
      expect(Object.keys(p.light).sort()).toEqual(Object.keys(p.dark).sort());
      expect(Object.keys(p.light)).toHaveLength(17);
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
