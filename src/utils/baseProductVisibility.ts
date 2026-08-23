/**
 * The one rule for "does this product still offer its base row?", mirroring the server's
 * `BaseProductVisibility` (backend #399). Track F / F2.
 *
 * `Product.HideBaseProduct` is what the admin stored; this is what every surface must ACT on. The
 * difference is the degrade: a product whose variations are all inactive has nothing left to order
 * once the base row is gone, so the flag degrades to `false` and the base row comes back rather
 * than the item going silently dead. The backend guard degrades identically, so the two cannot
 * disagree about what is orderable.
 */

/** Only the fields the rule reads — every variation shape on the client has at least these. */
export interface BaseVisibilityVariation {
  isActive?: boolean;
  priceModifier?: number;
  displayOrder?: number;
  id?: string;
}

export function isBaseRowHidden(
  hideBaseProduct: boolean | undefined,
  variations: readonly BaseVisibilityVariation[] | undefined,
): boolean {
  return hideBaseProduct === true && (variations ?? []).some((v) => v.isActive !== false);
}

/**
 * What a card should print when the base row is hidden: the cheapest thing a guest can actually
 * buy. Modifiers are always additive on the base price (backend `ProductDtoMapper`), so this is
 * base + the smallest ACTIVE modifier — never the bare base price, which with the base row hidden
 * is a number nobody can pay.
 *
 * Falls back to the base price when no active variation carries one, which is also the answer for
 * the degraded case (no active variation ⇒ the base row is back).
 */
export function startingPrice(basePrice: number, variations: readonly BaseVisibilityVariation[] | undefined): number {
  const modifiers = (variations ?? [])
    .filter((v) => v.isActive !== false)
    .map((v) => v.priceModifier ?? 0)
    .filter((m) => Number.isFinite(m));

  if (modifiers.length === 0) return basePrice;
  return basePrice + Math.min(...modifiers);
}

/**
 * The variation a freshly-opened sheet starts on: the first ACTIVE one in DISPLAY order, i.e. the
 * first radio the guest can see. `null` when the product has none, which is the base row.
 *
 * The display-order sort is not cosmetic — `VariationsSection` renders in that order, and the
 * previous `variations[0]` opened the sheet on a variation with no visible radio whenever the first
 * one happened to be inactive.
 */
export function firstActiveVariationId(
  variations: readonly (BaseVisibilityVariation & { id?: string })[] | undefined,
): string | null {
  const active = (variations ?? [])
    .filter((v) => v.isActive !== false && !!v.id)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return active[0]?.id ?? null;
}
