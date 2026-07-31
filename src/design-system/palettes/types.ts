// Runtime colour-palette types (ADR-007). A palette re-declares a BOUNDED set of
// semantic colour tokens — the "identity" set: brand / surface / text / link /
// border — paired light + dark. It deliberately never touches the feedback/status
// hues (so success stays green, danger stays red under any palette) nor the
// theme-invariant --color-* primitives, keeping every override a safe, cohesive
// re-skin. See docs/adr/ADR-007-runtime-palette-theming.md.

export type SemanticColorName =
  | 'brand-primary'
  | 'brand-primary-dark'
  /** The brand as used on an ELEVATED surface (today: the top nav's current-page
   *  pill, a 5% wash over --surface-secondary). It MUST be in this set: without it
   *  a palette would repaint --brand-primary and leave the pill on the template's
   *  baked colour, which is both off-palette and — as measured — an AA failure. */
  | 'brand-primary-elevated'
  | 'brand-accent'
  | 'surface-primary'
  | 'surface-secondary'
  | 'surface-secondary-light'
  | 'surface-card'
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'text-on-primary'
  | 'text-on-accent'
  | 'link-default'
  | 'link-hover'
  | 'border-default'
  | 'border-light'
  | 'border-extra-light';

/** Every identity token, as a `#rrggbb` value. */
export type PaletteVars = Record<SemanticColorName, string>;

export interface Palette {
  /** Stable key stored on the backend (RestaurantInfo.themePaletteKey). */
  key: string;
  /** i18n key for the human-readable label (control/admin namespace). */
  labelKey: string;
  /** Representative chip colour for the picker (the light brand-primary). */
  swatch: string;
  light: PaletteVars;
  dark: PaletteVars;
}
