import { localizedName } from './localizedContent';
import { isSauce } from './sauceGroup';
import { buildBaseIngredientSelection } from './ingredientSelection';
import { groupSuggestedSideItems, type SuggestedSideGroup } from './suggestedSideItems';
import { findBundleOption } from './bundleSelection';
import type { CustomizationStep } from './customizationSteps';
import type { SelectedSide } from './linePrice';
import type { DetailedProduct, MenuSection, ProductIngredient, SelectedMenuOption } from '@/types/menu';

/**
 * What the review step reports back (MENU-CUSTOMIZATION-FLOW-PLAN §3.3).
 *
 * This is the redesign's answer to "make sure guests are not missing a section": every step is
 * listed, and a step they walked past reports an EMPTY list, which the review renders as an
 * explicit "None". The omission becomes visible and chosen rather than silent — which is exactly
 * what the collapsed disclosures this replaces could never do.
 *
 * Pure and React-free. Prices are deliberately absent: `useLinePrice` is the single price authority
 * and a second arithmetic here is how a summary comes to disagree with the total beside it.
 */

export interface ProductSummaryState {
  selectedVariationId: string | null;
  selectedIngredients: readonly string[];
  ingredientQuantities: Readonly<Record<string, number>>;
  selectedSideItems: readonly SelectedSide[];
}

const withQuantity = (name: string, quantity: number): string => (quantity > 1 ? `${quantity} × ${name}` : name);

/** The names a product step reports. An empty array means "the guest chose nothing here". */
export function productStepSummary(
  step: CustomizationStep,
  product: DetailedProduct,
  state: ProductSummaryState,
  language: string,
): string[] {
  const ingredients = product.detailedIngredients ?? [];

  switch (step.kind) {
    case 'variations':
      return variationSummary(product, state.selectedVariationId, language);
    case 'ingredients':
      return ingredientSummary(
        ingredients.filter((ingredient) => ingredient.isActive && !isSauce(ingredient)),
        state,
        language,
      );
    case 'sauces':
      return ingredients
        .filter((sauce) => sauce.isActive && isSauce(sauce) && state.selectedIngredients.includes(sauce.id))
        .map((sauce) => localizedName(sauce, language));
    case 'sides':
      return sideSummary(product, state, step.sideGroup);
    default:
      return [];
  }
}

function variationSummary(product: DetailedProduct, selectedId: string | null, language: string): string[] {
  if (selectedId === null) {
    // The base row IS an answer, not an absence — reporting "None" for it would tell the guest they
    // skipped a step they in fact answered by keeping the dish as it comes.
    return [localizedName(product, language)];
  }
  const variation = (product.variations ?? []).find((candidate) => (candidate.id || candidate.name) === selectedId);
  return variation ? [localizedName(variation, language)] : [];
}

/**
 * Only what the guest CHANGED, never the whole recipe.
 *
 * The base recipe arrives pre-ticked, so listing every selected ingredient would fill the review
 * with things nobody chose and bury the two that were actually changed. Removals matter as much as
 * additions here, and both are stated relative to `buildBaseIngredientSelection` — the same rule
 * the sheet seeds from, so "changed" means the same thing in both places.
 */
function ingredientSummary(
  ingredients: readonly ProductIngredient[],
  state: ProductSummaryState,
  language: string,
): string[] {
  const base = new Set(buildBaseIngredientSelection(ingredients).selectedIngredients);
  const lines: string[] = [];

  for (const ingredient of ingredients) {
    if (!ingredient.isOptional) continue;
    const isSelected = state.selectedIngredients.includes(ingredient.id);
    const wasInBase = base.has(ingredient.id);
    const quantity = state.ingredientQuantities[ingredient.id] ?? 1;

    if (isSelected && !wasInBase) lines.push(withQuantity(localizedName(ingredient, language), quantity));
    else if (isSelected && wasInBase && quantity > 1)
      lines.push(withQuantity(localizedName(ingredient, language), quantity));
    else if (!isSelected && wasInBase) lines.push(`− ${localizedName(ingredient, language)}`);
  }

  return lines;
}

/**
 * Whether the guest's CURRENT selection already answers this step — any ticked row in the step's
 * scope counts, INCLUDING the base-recipe ticks the sheet seeded. This is the skip decision, and
 * it is deliberately a different question from `productStepSummary`'s: the review lists what the
 * guest CHANGED (deviations from the base recipe), while the footer's skip verb is honest only
 * when walking past would keep NOTHING. A step answered by the base recipe commits an answer, so
 * it says Continue — partner report (mcdoner, 'Assiette Kebab'): a fully pre-selected ingredients
 * step used to offer "No extra", a lie about the order the press would build.
 */
export function stepHasTickedSelection(
  step: CustomizationStep,
  product: DetailedProduct,
  state: ProductSummaryState,
): boolean {
  const ingredients = product.detailedIngredients ?? [];

  switch (step.kind) {
    case 'variations':
      // The base row IS an answer (see `variationSummary`), and a dish ALWAYS has one in view: a
      // guest who kept the base row answered the step exactly as much as one who picked a
      // variation — a size cannot be skipped, only kept or changed. Always answered.
      return true;
    case 'ingredients':
      return ingredients.some(
        (ingredient) =>
          ingredient.isActive &&
          !isSauce(ingredient) &&
          ingredient.isOptional &&
          state.selectedIngredients.includes(ingredient.id),
      );
    case 'sauces':
      return ingredients.some(
        (ingredient) =>
          ingredient.isActive &&
          isSauce(ingredient) &&
          ingredient.isOptional &&
          state.selectedIngredients.includes(ingredient.id),
      );
    case 'sides': {
      // Each partition is its own step (`sideGroup`): a dessert tick answers the desserts step and
      // says nothing about the beverages step, which must still be allowed to say Skip. An
      // unpartitioned sides step reads every group.
      const selectedIds = new Set(state.selectedSideItems.map((side) => side.id));
      return groupSuggestedSideItems(product.suggestedSideItems ?? [])
        .filter((group) => step.sideGroup === undefined || group.id === step.sideGroup)
        .some((group) => group.items.some((item) => selectedIds.has(item.id)));
    }
    default:
      // `drinks` never reaches this helper: the upsell selection is not in ProductSummaryState,
      // so useSheetFlow.isSkip answers the drinks step straight from its summary row.
      return false;
  }
}

/**
 * `onlyGroup` scopes the row to ONE partition, because each partition is now its own step: without
 * it every side step's review row would list the same three groups' worth of chosen items, and
 * jumping back from any of them would land on a step whose summary described the other two.
 */
function sideSummary(product: DetailedProduct, state: ProductSummaryState, onlyGroup?: SuggestedSideGroup): string[] {
  return groupSuggestedSideItems(product.suggestedSideItems ?? [])
    .filter((group) => onlyGroup === undefined || group.id === onlyGroup)
    .flatMap((group) => group.items)
    .map((side) => ({ side, quantity: state.selectedSideItems.find((chosen) => chosen.id === side.id)?.quantity ?? 0 }))
    .filter((entry) => entry.quantity > 0)
    .map((entry) => withQuantity(entry.side.name, entry.quantity));
}

/** The names a bundle section step reports — the options picked, in the section's own order. */
export function bundleStepSummary(section: MenuSection, selectedOptions: readonly SelectedMenuOption[]): string[] {
  return section.items
    .filter((item) => findBundleOption(selectedOptions, section.id, item.productId))
    .map((item) => item.productName ?? '');
}
