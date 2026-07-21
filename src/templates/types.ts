// Tenant UI template contract (ADR-006, S15 T2/T4 — see docs/TEMPLATES.md).
// Every template under src/templates/<name>/ exports a TemplateDefinition;
// the build-time `@active-template` alias (next.config.ts) selects exactly
// one per tenant image, so only the active template's code/CSS/fonts are
// bundled. T2 shipped Shell + HomePage; T4 (owner decision 2026-07-18, over the
// plan's v1 deferral) adds the `surfaces` slot map so a template can override a
// shared customer surface (MenuCard, …) with genuinely-distinct DOM — resolved
// via `surfaceOr()` (src/templates/resolve-surface.tsx). A template omitting a
// slot renders the shared default, so classic is untouched by construction.

import type { MenuCardProps } from '@/components/menu/MenuCard';
import type { CategoryNavProps } from '@/components/menu/CategoryNav';
import type { MenuSectionStatusProps } from '@/components/menu/MenuSectionStatus';
import type { OrderFlowSidebarProps } from '@/components/order/OrderFlowSidebar';
import type { CartContentsProps } from '@/components/order/CartContents';

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

/**
 * Per-surface component overrides (S15 T4). A shared customer surface renders the
 * active template's override when present, else its own default (via `surfaceOr`).
 * Add a slot here only when a template actually ships a distinct version — an
 * omitted slot costs nothing (the shared default renders).
 *
 * Exposed via the SEPARATE `@active-template/surfaces` module (each template's
 * `surfaces.ts`), NOT on `TemplateDefinition` — so importing a slot into a surface
 * component never drags the eager `template` object (Shell/HomePage/fonts) into
 * that surface's client bundle. `surfaceOr()` resolves them.
 */
export interface TemplateSurfaces {
  /** The customer browse-grid card (menu page). */
  MenuCard?: React.ComponentType<MenuCardProps>;
  /** The menu category navigation (tabs). Craft ships masking-tape tabs. */
  CategoryNav?: React.ComponentType<CategoryNavProps>;
  /** The menu section heading + loading/error/empty states. Craft ships an
   *  Amatic heading + kraft skeleton plates + a hand-drawn empty plate. */
  MenuSectionStatus?: React.ComponentType<MenuSectionStatusProps>;
  /** The desktop cart rail chrome (menu page). Craft ships a ruled-paper
   *  "order pad" panel. */
  OrderFlowSidebar?: React.ComponentType<OrderFlowSidebarProps>;
  /** The cart-half contents (shared by the desktop rail + mobile sheet). Craft
   *  ships the hand-written order-pad list + kraft totals + terracotta CTA. */
  CartContents?: React.ComponentType<CartContentsProps>;
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
  /** The login-page composition (consumed via the `@active-template/LoginPage`
   *  re-export in src/app/auth/login/page.tsx). */
  LoginPage: React.ComponentType;
  /** The register-page composition (consumed via the
   *  `@active-template/RegisterPage` re-export). */
  RegisterPage: React.ComponentType;
  /** The checkout review/confirm page (consumed via the
   *  `@active-template/CheckoutReviewPage` re-export in
   *  src/app/checkout/review/page.tsx). Craft ships a two-column
   *  hand-written-bill re-skin around the shared `CheckoutReviewLayout`. */
  CheckoutReviewPage: React.ComponentType;
}
