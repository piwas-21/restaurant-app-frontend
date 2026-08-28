/**
 * The pure selection arithmetic behind the waiter's customization sheet.
 *
 * Split out of `useProductCustomizationSheet` for two reasons: the hook is capped at 200 LOC by
 * the §4 file-length gate and had 17 lines of headroom, and the rules below are the ones a test
 * needs to reach without React.
 *
 * What they encode is the difference between a SELECTION and a CHANGE. Since S7 the sheet opens on
 * the base recipe — every required ingredient plus every optional one the base price already paid
 * for — exactly as the guest sheet does. "Selected" therefore no longer means "the waiter added
 * it", and the order line must not say it does: an ingredient is an ADDITION only when it is
 * selected and was not in the base recipe (or is selected more times than the base recipe gives),
 * and a REMOVAL only when the base recipe had it and the selection does not.
 */
import { DEFAULT_INGREDIENT_QUANTITY, maxIngredientQuantity } from '@/utils/priceableIngredient';
import type { CustomizationResult, DetailedIngredient, SuggestedSideItem } from './productCustomizationTypes';

/** An ingredient row as the sheet holds it, plus how many of it are on the line. */
interface SelectionState {
  selectedIngredientIds: ReadonlySet<string>;
  ingredientQuantities: Readonly<Record<string, number>>;
}

/** Whether the base recipe already includes this ingredient — the guest sheet's one default rule. */
export function isInBaseRecipe(ingredient: DetailedIngredient): boolean {
  return !ingredient.isOptional || ingredient.isIncludedInBasePrice === true;
}

/** How many of an ingredient are on the line right now. Unselected is 0, whatever the map says. */
export function selectedQuantity(ingredientId: string, state: SelectionState): number {
  if (!state.selectedIngredientIds.has(ingredientId)) return 0;
  return state.ingredientQuantities[ingredientId] ?? DEFAULT_INGREDIENT_QUANTITY;
}

/**
 * One press of a stepper. Returns the next quantity, or 0 to mean "de-select it" — the same
 * convention the guest sheet's `OptionalIngredientsSection` uses, so a minus at 1 removes the
 * ingredient rather than dead-ending on a disabled button, and the removal survives into the
 * payload (the backend derives `IsRemoved` from quantity 0, issue #150).
 */
export function stepQuantity(current: number, change: number, ingredient: DetailedIngredient): number {
  const next = current + change;
  if (next <= 0) return 0;
  return Math.min(next, maxIngredientQuantity(ingredient));
}

export interface IngredientChange {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * What CHANGED against the base recipe, split into what was added and what was taken off.
 *
 * Only optional ingredients can appear: a required one is not removable on any surface, and it has
 * no price of its own to add (the price math skips it too).
 */
export function diffAgainstBaseRecipe(
  ingredients: readonly DetailedIngredient[],
  state: SelectionState,
  nameOf: (ingredient: DetailedIngredient) => string,
): { added: IngredientChange[]; removed: IngredientChange[] } {
  const added: IngredientChange[] = [];
  const removed: IngredientChange[] = [];

  for (const ingredient of ingredients) {
    if (!ingredient.isActive || !ingredient.isOptional) continue;

    const inBase = isInBaseRecipe(ingredient);
    const quantity = selectedQuantity(ingredient.id, state);
    const change: IngredientChange = {
      id: ingredient.id,
      name: nameOf(ingredient),
      price: ingredient.price ?? 0,
      quantity,
    };

    if (quantity === 0) {
      // Only a base-recipe ingredient can be REMOVED; an unticked paid extra is simply not ordered.
      if (inBase) removed.push({ ...change, quantity: 1 });
      continue;
    }

    // In the base recipe at quantity 1 the line is unchanged — that is what "included" means.
    if (inBase && quantity === DEFAULT_INGREDIENT_QUANTITY) continue;

    added.push(change);
  }

  return { added, removed };
}

interface BuildResultArgs {
  productId: string;
  variationId?: string;
  variationName?: string;
  ingredients: readonly DetailedIngredient[];
  selection: SelectionState;
  sideItems: readonly SuggestedSideItem[];
  selectedSideItems: ReadonlyMap<string, number>;
  specialInstructions: string;
  /** Unit price from the shared price math — NOT re-derived here, so there is still one writer. */
  unitPrice: number;
  nameOf: (ingredient: DetailedIngredient) => string;
}

/** The payload the take-order list receives for one confirmed customization. */
export function buildCustomizationResult(args: BuildResultArgs): CustomizationResult {
  const { added, removed } = diffAgainstBaseRecipe(args.ingredients, args.selection, args.nameOf);

  return {
    productId: args.productId,
    variationId: args.variationId,
    variationName: args.variationName,
    addedIngredients: added,
    removedIngredients: removed,
    sideItems: Array.from(args.selectedSideItems.entries()).map(([id, quantity]) => {
      const side = args.sideItems.find((s) => s.id === id);
      return { id, name: side?.name || '', quantity, price: side?.price || 0 };
    }),
    specialInstructions: args.specialInstructions || undefined,
    finalPrice: args.unitPrice,
  };
}
