/**
 * The sauce group — the two shapes S6 renders and S5 (backend #426) persists.
 *
 * They live in their own module rather than in `shared.ts` because that file is a `src/types/**`
 * file, capped at 150 LOC by the file-length gate, and it was already at 144.
 */

/**
 * What an ingredient row IS — the mirror of the backend `IngredientKind` enum (S5, backend #426),
 * which serialises through `StringEnumConverter` as its `EnumMember` value (`"ingredient"` /
 * `"sauce"`), never as a number.
 *
 * A sauce is a TYPED ingredient, not a second entity (plan D7/D8): same id, same row, same money,
 * grouped apart for the admin and — since S6 — for the guest. That is the only shape with zero
 * impact on the `IngredientQuantitiesJson` maps a basket and an immutable order already carry.
 *
 * Absent on a backend that predates the field, and absent reads as `'ingredient'` — which is what
 * every row meant before it existed. Never test it bare: `isSauce()` in `@/utils/sauceGroup` applies
 * that degrade in one place.
 */
export type IngredientKind = 'ingredient' | 'sauce';

/**
 * The product-level sauce group rule (plan D9, backend `Product.SauceMin` / `SauceMax` /
 * `SauceIncludedFree`). Three admin-editable numbers with NO tenant default baked into code (owner
 * ruling, plan §7 Q3), and deliberately NOT a general min/max-select engine (§7 Q2).
 */
export interface SauceGroupRule {
  /** How many sauces the guest MUST choose. 0 = none required, which is every product today. */
  min: number;
  /**
   * The most the guest may choose, or `null` for NO group cap.
   *
   * Nullable and not "0 means unlimited", because 0 is itself meaningful — "this product takes no
   * sauces at all" — so the two states must stay distinguishable (backend D9a).
   */
  max: number | null;
  /**
   * How many chosen sauces are free before the per-row price applies. The number is READ here and
   * priced in exactly one place — the backend `BasketPricingService`, mirrored for the live
   * "Add • CHF X" by `sauceWaiverAmount` in `@/utils/sauceGroup`. Nothing else may compute money
   * from it (plan D10).
   */
  includedFree: number;
}

/**
 * The three wire fields of the sauce group rule as the backend sends them (`ProductDto`,
 * `MenuBundleSectionItemDto`). Every field is optional: a backend that predates S5 sends none of
 * them, and the degrade — no minimum, no cap, nothing free — is exactly today's behaviour.
 *
 * Read them through `toSauceGroupRule()` in `@/utils/sauceGroup`, never field by field: `sauceMax`
 * has TWO absent states that mean the same thing (`undefined` from an old backend, `null` from a
 * current one) and exactly one that does not (`0` = takes no sauces).
 */
export interface SauceGroupCarrier {
  sauceMin?: number;
  sauceMax?: number | null;
  sauceIncludedFree?: number;
}

/** The neutral rule: nothing required, no cap, nothing free — a product that never mentions sauces. */
export const NO_SAUCE_RULE: SauceGroupRule = { min: 0, max: null, includedFree: 0 };
