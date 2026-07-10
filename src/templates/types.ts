// Tenant UI template contract (ADR-006, S15 T2 — see docs/TEMPLATES.md).
// Every template under src/templates/<name>/ exports a TemplateDefinition;
// the build-time `@active-template` alias (next.config.ts) selects exactly
// one per tenant image, so only the active template's code/CSS/fonts are
// bundled. v1 keeps this contract deliberately minimal: per-surface slots
// (MenuList, CheckoutSummary, …) are explicitly a v2 mechanism.

/**
 * A loaded `next/font` instance. Structural subset of next/font's return
 * type — templates apply fonts via className (as the root layout always
 * did with Inter), so `variable`-based loading is not part of the v1
 * contract. Any `next/font/google` or `next/font/local` result satisfies
 * this shape.
 */
export interface TemplateFont {
  className: string;
}

export interface ShellProps {
  children: React.ReactNode;
}

export interface TemplateDefinition {
  /** Template style name (`classic`, `craft`) — a style, never a tenant. */
  name: string;
  /**
   * Fonts loaded via next/font in the template's fonts.ts. The root layout
   * joins their classNames onto <body>.
   */
  fonts: TemplateFont[];
  /**
   * Customer-facing app chrome (header/nav/footer). Staff/admin chrome is
   * NOT templated in v1 and stays shared.
   */
  Shell: React.ComponentType<ShellProps>;
  /** The landing-page composition. */
  HomePage: React.ComponentType;
}
