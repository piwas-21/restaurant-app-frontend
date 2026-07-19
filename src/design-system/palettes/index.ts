// Runtime colour-palette registry (ADR-007). The values live here as versioned,
// AA-gated code; the backend stores only the chosen `key`. Switching among these
// presets is a rebuild-free DB write; adding one is a reviewed release.
import { PALETTES } from './presets';
import type { Palette, PaletteVars, SemanticColorName } from './types';

export type { Palette, PaletteVars, SemanticColorName } from './types';
export { PALETTES } from './presets';

/** Resolve a stored key to its preset, or undefined for null/unknown keys. */
export function getPalette(key: string | null | undefined): Palette | undefined {
  if (!key) return undefined;
  return PALETTES.find((p) => p.key === key);
}

function block(selector: string, vars: PaletteVars): string {
  const decls = (Object.entries(vars) as [SemanticColorName, string][])
    .map(([name, value]) => `--${name}:${value}`)
    .join(';');
  return `${selector}{${decls}}`;
}

/**
 * Serialise a preset to the paired override CSS the SSR `<style>` emits (ADR-007
 * decision 4). Selectors are DOUBLED (`:root:root` and `html[data-theme='dark']:root`)
 * so the runtime block wins by SPECIFICITY over the template's plain `:root` /
 * `html[data-theme='dark']` tokens — regardless of where the `<style>` lands in the
 * document, so it is robust against head-injection / style-hoisting order (no reliance
 * on source order). In dark mode the dark selector (0,2,1) still outranks the light
 * one (0,2,0). Unknown/empty key → empty string: the SAFE DEFAULT — the template's
 * baked palette renders byte-identical, so an un-themed tenant is never touched.
 */
export function paletteToCss(key: string | null | undefined): string {
  const palette = getPalette(key);
  if (!palette) return '';
  return block(':root:root', palette.light) + block("html[data-theme='dark']:root", palette.dark);
}
