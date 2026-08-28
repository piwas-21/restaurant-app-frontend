import type { IngredientKind, SauceGroupCarrier, SauceGroupRule } from '@/types/menu/sauce';

/**
 * The sauce group, as one place (SHARED-MODIFIERS-AND-SAUCES-PLAN S6, D9–D12).
 *
 * Everything the guest sheet needs to split sauces out of the ingredient list, derive its widget,
 * and — the part that matters — decide which chosen sauces the product's `includedFree` allowance
 * pays for. That last rule is MONEY, and money has exactly one writer: the backend
 * `BasketPricingService.CalculateIngredientCustomizationPrice`. What lives here is the same
 * faithful mirror `utils/linePrice.ts` already is for the rest of ingredient pricing, so the live
 * "Add • CHF X" matches what the server will charge — and, deliberately, the sheet's own
 * "Included" badge is read from the SAME allocation the price uses, so a badge cannot claim a
 * waiver the total did not apply.
 */

/** The minimal ingredient shape the sauce rules need — satisfied by `PriceableIngredient`. */
export interface SauceCandidate {
  id: string;
  price: number;
  isOptional: boolean;
  isActive: boolean;
  isIncludedInBasePrice?: boolean;
  maxQuantity?: number;
  displayOrder?: number;
  kind?: IngredientKind;
}

/**
 * Is this row a sauce? The one place the absent-means-ingredient degrade is applied: `kind` is
 * additive (backend #426) and every row written before it carries nothing.
 */
export function isSauce(ingredient: { kind?: IngredientKind }): boolean {
  return ingredient.kind === 'sauce';
}

/**
 * The product's group rule, with every absent field degraded to the neutral value.
 *
 * `sauceMax` needs the care: `undefined` (pre-S5 backend) and `null` (current backend, "no cap")
 * both mean unbounded, while `0` means "this product takes no sauces at all" and must survive.
 */
export function toSauceGroupRule(carrier: SauceGroupCarrier | undefined | null): SauceGroupRule {
  return {
    min: carrier?.sauceMin ?? 0,
    max: carrier?.sauceMax ?? null,
    includedFree: carrier?.sauceIncludedFree ?? 0,
  };
}

/** Quantity clamped exactly as the backend clamps it: `[0, maxQuantity]`, a missing max being 1. */
export function clampedQuantity(ingredient: SauceCandidate, quantities?: Record<string, number>): number {
  const max = ingredient.maxQuantity ?? 1;
  return Math.max(0, Math.min(max, quantities?.[ingredient.id] ?? 1));
}

/**
 * How many units of this row the guest is actually being CHARGED for under the per-row rule —
 * the units the group allowance can then waive.
 *
 * An included-in-base sauce is already free for its first unit, so only the extras beyond it are
 * chargeable; anything else is charged for every selected unit. A deselected row is charged for
 * nothing (its refund, if it has one, is the per-row rule's business and never the waiver's).
 */
export function chargeableSauceUnits(
  ingredient: SauceCandidate,
  isSelected: boolean,
  quantities?: Record<string, number>,
): number {
  if (!isSelected || ingredient.price <= 0) return 0;
  const quantity = clampedQuantity(ingredient, quantities);
  return ingredient.isIncludedInBasePrice ? Math.max(0, quantity - 1) : quantity;
}

/**
 * Allocate the product's free-sauce allowance across the chosen sauces, returning the number of
 * WAIVED units per ingredient id.
 *
 * **The most expensive chargeable unit is waived first**, tie-broken by `displayOrder` and then by
 * id. Three reasons, in order of weight: it is the customer-friendly reading of "one sauce is
 * free"; it is deterministic, so the sheet and the server reach the same answer; and it does not
 * depend on the ORDER of the client's selection array, which would otherwise turn the shape of a
 * JSON list into a price lever. The `displayOrder` tie-break is what makes the badge land on the
 * first sauce the guest sees when every sauce costs the same — which is the common case, and what
 * the approved design draws.
 *
 * The allowance can only ever remove charges that exist, so it can never create a refund, and a
 * product with `includedFree: 0` — every product on prod today — gets an empty map and no change.
 */
export function waivedSauceUnits(
  ingredients: readonly SauceCandidate[] | undefined,
  selectedIngredientIds: Iterable<string>,
  quantities: Record<string, number> | undefined,
  includedFree: number,
): Map<string, number> {
  const waived = new Map<string, number>();
  if (!ingredients || includedFree <= 0) return waived;

  const selected = selectedIngredientIds instanceof Set ? selectedIngredientIds : new Set(selectedIngredientIds);

  const chargeable = ingredients
    .filter((ingredient) => isSauce(ingredient) && ingredient.isOptional && ingredient.isActive)
    .map((ingredient) => ({
      ingredient,
      units: chargeableSauceUnits(ingredient, selected.has(ingredient.id), quantities),
    }))
    .filter((entry) => entry.units > 0)
    .sort(
      (a, b) =>
        b.ingredient.price - a.ingredient.price ||
        (a.ingredient.displayOrder ?? 0) - (b.ingredient.displayOrder ?? 0) ||
        a.ingredient.id.localeCompare(b.ingredient.id),
    );

  let remaining = includedFree;
  for (const entry of chargeable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, entry.units);
    waived.set(entry.ingredient.id, take);
    remaining -= take;
  }

  return waived;
}

/** The money the allowance takes off the line — derived from `waivedSauceUnits`, never re-derived. */
export function sauceWaiverAmount(
  ingredients: readonly SauceCandidate[] | undefined,
  selectedIngredientIds: Iterable<string>,
  quantities: Record<string, number> | undefined,
  includedFree: number,
): number {
  if (!ingredients) return 0;

  const waived = waivedSauceUnits(ingredients, selectedIngredientIds, quantities, includedFree);
  let amount = 0;
  for (const ingredient of ingredients) {
    amount += (waived.get(ingredient.id) ?? 0) * ingredient.price;
  }
  return amount;
}

/**
 * The guest widget, DERIVED from the rule and never chosen by the admin (D11): a group that admits
 * exactly one sauce is a radio group, everything else is checkboxes.
 */
export function sauceWidget(rule: SauceGroupRule): 'radio' | 'checkbox' {
  return rule.max === 1 ? 'radio' : 'checkbox';
}

/**
 * Is the group full? `null` max is no cap, so it never is. Counted in chosen ROWS, which is what
 * the guest sees: the sauce widget offers no quantity stepper, so a row is one sauce.
 */
export function isSauceGroupFull(selectedSauceCount: number, rule: SauceGroupRule): boolean {
  return rule.max !== null && selectedSauceCount >= rule.max;
}
