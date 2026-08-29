/**
 * What the menu editor can HONESTLY call "not filled in yet" (MENU-ITEM-EDITOR-REDESIGN-PLAN, S10).
 *
 * One rule list, two surfaces: the editor's side-rail meter and the menu list's row chips. They are
 * the same claim about the same item, so they must not be computed twice — a second implementation
 * is how a list chip and a rail row come to disagree about one product.
 *
 * ## Why the list is this short, and why that is the finding
 *
 * A field is scored only when BOTH hold:
 *
 *  1. **Its empty state is unambiguous.** The schema must be able to tell "nobody filled this in"
 *     from "this is deliberately empty". Where it cannot, a score is a guess presented as a fact.
 *  2. **An item can always reach "done".** A row that some perfectly good item can never satisfy is
 *     a permanent nag, and a meter that never reaches its total is one the admin learns to ignore.
 *
 * And one boundary: **the save bar owns what is INVALID; this meter owns what is merely EMPTY.**
 * `name`, `categoryIds` and `primaryCategoryId` are required by `editProductSchema`, so an item
 * missing them cannot be saved at all and S7's error summary already says so, by field, with a jump
 * link. Repeating them here would put the same problem on screen twice in two different tones.
 *
 * That leaves two fields today, and every rejection below is a measurement rather than a preference:
 *
 * | Field | Scored? | Why |
 * |---|---|---|
 * | photo | YES | `images.length === 0` means exactly one thing, and any item can be given a photo. |
 * | description | YES | `description` is `.optional()` in the schema; blank means blank, and any item can be described. |
 * | allergens | **NO — see below** | Fails (1) AND (2). |
 * | base price | NO | Fails (1). `basePrice: z.coerce.number().min(0)` — **0 is legal**, and it is a real, shipped configuration: `hideBaseProduct` exists precisely so an item is sold through its variations, with the base row withheld. So `basePrice === 0` cannot tell "price not typed yet" from "priced by its variations" or from a genuinely free item. |
 * | preparation time | NO | Fails (1). `0` is both the schema default and a legitimate value. |
 * | kitchen type | NO | Fails (1). `'None'` is both the default and a real routing choice. |
 * | translations | NO | Owned by the Translations tab, which already computes per-locale progress (S4, `translationSlots.ts`). A second count of the same thing in the rail is drift waiting to happen. |
 *
 * ## Allergens are deliberately NOT scored (plan §14, option 3)
 *
 * `allergens` is a plain `string[]`, so an empty array is reached by two routes the schema cannot
 * tell apart: the kitchen reviewed the recipe and there is nothing to declare, or nobody has looked
 * yet. Both available scores are wrong for somebody, and they are not equally wrong:
 *
 *  - scoring an empty list **complete** returns a green tick at the exact moment nobody has looked.
 *    Asserting the ABSENCE of allergens is a regulated claim (EU FIC 1169/2011 art. 7(1)(c) and
 *    36(2)(c); CH LDAl art. 18(1); ODAlOUs art. 12(2)(a)) — see
 *    `docs/plans/_research/allergen-declaration-evidence.md` — and for non-prepacked restaurant food
 *    allergens are the ONLY mandatory particular (FIC art. 44(1)(a)). A meter that blesses an
 *    unreviewed item misleads a tenant about their own compliance posture;
 *  - scoring it **incomplete** nags an allergen-free item forever, with nothing it can do to satisfy
 *    the row — a violation of (2) above.
 *
 * So allergens are left OUT of the score, and the meter SAYS SO with the reason
 * (`editor_completeness_allergens_note`) rather than silently omitting them. Silence would read as
 * "allergens are fine", which is the misleading green by another route.
 *
 * **This is an UPGRADE point, not a permanent shape.** The day the product gains a recorded-check
 * field (`allergensReviewed` + `reviewedBy` + `reviewedAt`, plan §14 option 1), an empty list stops
 * being ambiguous: `reviewed && allergens.length === 0` is "declared allergen-free" and
 * `!reviewed` is "nobody has looked". Both conditions above are then satisfied, and the change is
 * ONE entry appended to `COMPLETENESS_RULES` plus one deleted note — no caller, no surface and no
 * other rule moves.
 */

/** The fields this meter scores. Extend by appending to `COMPLETENESS_RULES`, never in two places. */
export type CompletenessFieldId = 'photo' | 'description';

export interface ProductCompletenessInput {
  /** How many photos the item has. A bundle has no gallery (frontend #524) and is not scored. */
  readonly photoCount: number;
  /** The item's base-language description. Whitespace does not count as filled in. */
  readonly description?: string | null;
}

export interface ProductCompleteness {
  readonly done: number;
  readonly total: number;
  /** In `COMPLETENESS_RULES` order, so two surfaces list the same gaps the same way round. */
  readonly missing: readonly CompletenessFieldId[];
}

interface CompletenessRule {
  readonly id: CompletenessFieldId;
  readonly isSatisfied: (input: ProductCompletenessInput) => boolean;
}

/**
 * The whole score, in one place, in display order.
 *
 * A rule list rather than a hand-written `if` chain because the count, the per-row states and the
 * list chips all have to be derived from the SAME source — otherwise "1 of 2 done" and the rows
 * beneath it can disagree, which is the one thing a progress meter must never do.
 */
export const COMPLETENESS_RULES: readonly CompletenessRule[] = [
  { id: 'photo', isSatisfied: (input) => input.photoCount > 0 },
  { id: 'description', isSatisfied: (input) => (input.description ?? '').trim().length > 0 },
];

/** The scored fields, in display order. */
export const SCORED_COMPLETENESS_FIELDS: readonly CompletenessFieldId[] = COMPLETENESS_RULES.map((rule) => rule.id);

export function getProductCompleteness(input: ProductCompletenessInput): ProductCompleteness {
  const missing = COMPLETENESS_RULES.filter((rule) => !rule.isSatisfied(input)).map((rule) => rule.id);
  return { done: COMPLETENESS_RULES.length - missing.length, total: COMPLETENESS_RULES.length, missing };
}

/** The shape of a menu-list row this module reads. Deliberately narrower than `Product`. */
export interface ProductSummaryLike {
  readonly description?: string | null;
  readonly images?: readonly unknown[] | null;
}

/**
 * The same score for a MENU LIST row.
 *
 * The photo count comes from `images`, never from `imageUrl`, and that is measured rather than
 * stylistic: the admin list is served by `GetProductsQuery`, which projects through
 * `ProductSummaryMapper.MapToSummaryDto` — and that mapper **never assigns `ImageUrl`**. It fills
 * `Images` and leaves `ImageUrl` null on every row. (Only `GetSpecialProductsQuery` and
 * `GetFeaturedSpecialQuery` set it, and neither feeds this page.) A chip driven off `imageUrl` would
 * therefore have said "needs photo" about 100% of the menu, including every item that has one.
 */
export function getSummaryRowCompleteness(row: ProductSummaryLike): ProductCompleteness {
  return getProductCompleteness({ photoCount: row.images?.length ?? 0, description: row.description });
}
