import type { CustomizationStep } from './customizationSteps';
import { customizationGroupSummary } from './customizationSummary';
import { localizedName } from './localizedContent';
import { isSauce, rendersNoSauceAnswer, toSauceGroupRule } from './sauceGroup';
import type { MenuSectionItem, SelectedMenuOption } from '@/types/menu';

/** Summarizes a bundle component screen from its exact selected MenuSectionItem row. */
export function bundleComponentStepSummary(
  step: CustomizationStep,
  selectedOptions: readonly SelectedMenuOption[],
  language: string,
  noSauceLabel: string,
): string[] {
  if (!step.component || !step.sectionItemId) return [];
  const option = selectedOptions.find(
    (candidate) => candidate.menuSectionItemId === step.sectionItemId && candidate.itemId === step.component?.productId,
  );
  if (!option) return [];

  switch (step.kind) {
    case 'variations':
      return variationValues(step.component, option, language);
    case 'ingredients':
      return ingredientValues(step, step.component, option, language);
    case 'sauces':
      return sauceValues(step, step.component, option, language, noSauceLabel);
    case 'group':
      return (step.groups ?? (step.group ? [step.group] : [])).flatMap((group) =>
        customizationGroupSummary(
          group,
          step.component?.detailedIngredients ?? [],
          option.customizationSelections ?? [],
          language,
        ),
      );
    case 'sides':
      return sideValues(step, step.component, option);
    case 'special':
      return option.specialInstructions?.trim() ? [option.specialInstructions.trim()] : [];
    default:
      return [];
  }
}

function variationValues(item: MenuSectionItem, option: SelectedMenuOption, language: string): string[] {
  const variationId = option.componentProductVariationId ?? option.productVariationId ?? item.productVariationId;
  if (variationId) {
    const variation = item.variations?.find((candidate) => candidate.id === variationId);
    return variation ? [localizedName(variation, language)] : [];
  }
  return item.productName ? [item.productName] : [];
}

function ingredientValues(
  step: CustomizationStep,
  item: MenuSectionItem,
  option: SelectedMenuOption,
  language: string,
): string[] {
  const selected = new Set(option.selectedIngredients ?? []);
  const scope = new Set(step.ingredientIds ?? []);
  return (item.detailedIngredients ?? [])
    .filter(
      (ingredient) =>
        ingredient.isActive && !isSauce(ingredient) && scope.has(ingredient.id) && selected.has(ingredient.id),
    )
    .map((ingredient) =>
      withQuantity(localizedName(ingredient, language), option.ingredientQuantities?.[ingredient.id] ?? 1),
    );
}

function sauceValues(
  step: CustomizationStep,
  item: MenuSectionItem,
  option: SelectedMenuOption,
  language: string,
  noSauceLabel: string,
): string[] {
  const sauceIds = new Set(step.sauceIds ?? step.ingredientIds ?? []);
  const sauces = (item.detailedIngredients ?? []).filter(
    (ingredient) => ingredient.isActive && isSauce(ingredient) && sauceIds.has(ingredient.id),
  );
  const selected = new Set(option.selectedIngredients ?? []);
  const values = sauces
    .filter((sauce) => selected.has(sauce.id))
    .map((sauce) => withQuantity(localizedName(sauce, language), option.ingredientQuantities?.[sauce.id] ?? 1));
  if (values.length > 0) return values;

  const allChoosableSauces = (item.detailedIngredients ?? []).filter(
    (ingredient) => ingredient.isActive && ingredient.isOptional && isSauce(ingredient),
  );
  return rendersNoSauceAnswer(allChoosableSauces.length, toSauceGroupRule(item)) ? [noSauceLabel] : [];
}

function sideValues(step: CustomizationStep, item: MenuSectionItem, option: SelectedMenuOption): string[] {
  const inScope = new Set(step.sideItemIds ?? []);
  return (item.suggestedSideItems ?? [])
    .filter((side) => inScope.has(side.id))
    .flatMap((side) => {
      const selected = (option.selectedSideItems ?? []).find(
        (choice) => choice.suggestedSideItemId === side.id && choice.id === side.sideItemProductId,
      );
      return selected && selected.quantity > 0 && side.sideItemProductName
        ? [withQuantity(side.sideItemProductName, selected.quantity)]
        : [];
    });
}

function withQuantity(name: string, quantity: number): string {
  return quantity > 1 ? `${quantity} × ${name}` : name;
}
