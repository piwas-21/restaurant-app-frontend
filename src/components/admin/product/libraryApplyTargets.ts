/**
 * The arithmetic behind "apply this library row to many items" and its blast-radius confirm
 * (SHARED-MODIFIERS-AND-SAUCES-PLAN, slice S8, decision D6).
 *
 * Pure, and separate from the modal, because every claim the confirm makes is a COUNT the admin is
 * about to act on — "this will change 38 items" is the sentence that licenses a catalog-wide write,
 * so it is worth an oracle rather than a render.
 *
 * **The whole file exists because a product can belong to more than one category.** `Product.categories`
 * is a LIST, so "every pizza" and "every lunch special" overlap, and the same product is offered
 * twice by the screen. Every function here therefore counts DISTINCT PRODUCTS, never rows, never
 * ticks — which is the same rule the backend's "used on N items" follows (COUNT DISTINCT product),
 * and it has to be, or the confirm and the receipt disagree about the same word.
 */

/** A product the picker may attach to. Structurally satisfied by the admin product list row. */
export interface ApplyTargetProduct {
  id: string;
  name: string;
  isActive?: boolean;
  categories?: { categoryId: string; categoryName: string }[];
}

/** One group the screen draws, with the products under it in the order they arrived. */
export interface ApplyTargetGroup {
  categoryId: string;
  categoryName: string;
  productIds: string[];
}

/**
 * The tick state of a category header.
 *
 * `'some'` is a real third state and not a rounding of `'none'`: it is what an indeterminate
 * checkbox renders, and collapsing it to unticked would tell an admin who has hand-picked four of
 * forty pizzas that they have picked none.
 */
export type GroupSelection = 'none' | 'some' | 'all';

/**
 * The bucket for a product no category claims.
 *
 * It is a REAL group rather than a hidden remainder: a product with no category is exactly the one
 * an admin cannot reach through "apply to every pizza", so hiding it would make the catalog-wide
 * action quietly incomplete in the one case the admin cannot see.
 */
export const UNCATEGORISED_GROUP_ID = '__uncategorised__';

/**
 * Groups products for display, one entry per category the products actually use.
 *
 * Categories are ordered by name and products keep their incoming order, so the dialog reads the
 * same way twice — the confirm is a promise about a specific list, and a list that reshuffles
 * between the read and the click is not one.
 *
 * A product in two categories APPEARS TWICE, deliberately: the screen is a map of categories, and a
 * pizza missing from "Lunch" because it was already drawn under "Pizzas" would misrepresent what
 * "select all Lunch" is about to do. The double-count is undone by every counting function below.
 */
export function groupProductsByCategory(
  products: readonly ApplyTargetProduct[],
  uncategorisedName: string,
): ApplyTargetGroup[] {
  const byCategory = new Map<string, ApplyTargetGroup>();

  for (const product of products) {
    const links = product.categories?.length
      ? product.categories
      : [{ categoryId: UNCATEGORISED_GROUP_ID, categoryName: uncategorisedName }];

    for (const link of links) {
      const existing = byCategory.get(link.categoryId);
      if (existing) {
        existing.productIds.push(product.id);
      } else {
        byCategory.set(link.categoryId, {
          categoryId: link.categoryId,
          categoryName: link.categoryName,
          productIds: [product.id],
        });
      }
    }
  }

  return [...byCategory.values()].sort((a, b) => {
    // The remainder sorts last whatever it is called, because its name is a translated string and
    // its position should not move between locales.
    if (a.categoryId === UNCATEGORISED_GROUP_ID) return 1;
    if (b.categoryId === UNCATEGORISED_GROUP_ID) return -1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

/**
 * Which products in a group the admin can still act on — that is, the ones that do not already
 * carry this library row.
 *
 * Everything else here is expressed in terms of this set, because "select all" that ticked a
 * product already carrying the row would raise the count the confirm shows without changing what
 * the write does. The backend reports such a product as `alreadyLinked` and steps over it, so a
 * screen that counted it would be promising a change the server has already decided not to make.
 */
function actionableIn(group: ApplyTargetGroup, alreadyAttachedIds: ReadonlySet<string>): string[] {
  return group.productIds.filter((id) => !alreadyAttachedIds.has(id));
}

/** The tick state of one category header. A group with nothing left to do reads as `'all'`. */
export function groupSelectionState(
  group: ApplyTargetGroup,
  selectedIds: ReadonlySet<string>,
  alreadyAttachedIds: ReadonlySet<string>,
): GroupSelection {
  const actionable = actionableIn(group, alreadyAttachedIds);

  // A category whose every product already carries the row is DONE, not empty. Reporting `'none'`
  // would invite a click that ticks nothing and changes nothing, with no way to tell why.
  if (actionable.length === 0) return 'all';

  const picked = actionable.filter((id) => selectedIds.has(id)).length;
  if (picked === 0) return 'none';
  return picked === actionable.length ? 'all' : 'some';
}

/**
 * Ticking or unticking a category header.
 *
 * **The selection means "what the admin ticked", NOT "what will be sent"** — the two are different
 * sets and `buildApplyPlan` is the one that separates them. So ticking a category selects EVERY
 * product under it, including the ones that already carry the row: on screen those boxes are already
 * drawn ticked, so leaving them out of the set would make the model disagree with the picture, and
 * it would make "2 already have it" a sentence the footer could never reach — which is exactly the
 * defect this shape replaced.
 *
 * Both directions are scoped to this group, so a product shared with another category keeps whatever
 * that category's ticks gave it.
 */
export function toggleGroup(group: ApplyTargetGroup, select: boolean, selectedIds: ReadonlySet<string>): Set<string> {
  const next = new Set(selectedIds);
  for (const id of group.productIds) {
    if (select) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return next;
}

/** What the confirm step states, and what the request will carry. */
export interface ApplyPlan {
  /** Distinct product ids the request should send, in the order the products were listed. */
  productIds: string[];
  /** How many DISTINCT products this write will change — the blast radius (plan D6). */
  willChangeCount: number;
  /** Selected products the write will step over because they already carry the row. */
  alreadyHaveCount: number;
}

/**
 * The blast radius, derived from the selection rather than from the ticks.
 *
 * <b>It filters the already-attached products out of the request, and still REPORTS them.</b> Both
 * halves matter: sending them would make the server's `skipped[]` do work the screen could have
 * done, and hiding them would leave an admin who selected forty pizzas wondering why the receipt
 * says thirty-eight.
 *
 * The count is over DISTINCT ids in the PRODUCT list order — not over the selection set — so a
 * product ticked through two categories is one item, one id in the payload, and one line in the
 * sentence.
 */
export function buildApplyPlan(
  products: readonly ApplyTargetProduct[],
  selectedIds: ReadonlySet<string>,
  alreadyAttachedIds: ReadonlySet<string>,
): ApplyPlan {
  const seen = new Set<string>();
  const productIds: string[] = [];
  let alreadyHaveCount = 0;

  for (const product of products) {
    if (!selectedIds.has(product.id) || seen.has(product.id)) continue;
    seen.add(product.id);

    if (alreadyAttachedIds.has(product.id)) {
      alreadyHaveCount += 1;
      continue;
    }
    productIds.push(product.id);
  }

  return { productIds, willChangeCount: productIds.length, alreadyHaveCount };
}
