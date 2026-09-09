'use client';

import React from 'react';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import SauceGroupSection from './SauceGroupSection';
import { toSauceGroupRule } from '@/utils/sauceGroup';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { ProductIngredient, SauceGroupCarrier } from '@/types/menu';

interface IngredientStepsBodyProps {
  /** The rule carrier — a product OR a bundle option; both carry the sauce group fields (S6). */
  sauceGroup: SauceGroupCarrier;
  /** The carrier's whole ingredient list — sauces are picked out of it, in one place. */
  ingredients: readonly ProductIngredient[];
  /** The step on screen. This body renders exactly two kinds: `ingredients` and `sauces`. */
  step: CustomizationStep;
  selectedIngredients: string[];
  ingredientQuantities: Record<string, number>;
  onSelectionChange: (selected: string[]) => void;
  onQuantityChange: (ingredientId: string, quantity: number) => void;
  /** Announces that a single-choice step has been answered, so the flow may advance itself. */
  onChoice: () => void;
  currentLanguage: string;
}

/**
 * The one body BOTH guided flows render for their ingredient decisions — the product sheet and the
 * per-option screen inside a bundle sheet. Extracted from `ProductSheetBody` so the two surfaces
 * share the step machinery instead of forking it: same sections, same handlers, same auto-advance
 * rule, same payload — which is what makes a combo's sauces behave exactly like the dish's.
 *
 * Sauces are their OWN step here. On the ingredients step the group is switched off
 * (`includeSauces={false}`): left on, the group would render in BOTH steps at once and each copy
 * could undo the other's selection.
 */
export default function IngredientStepsBody({
  sauceGroup,
  ingredients,
  step,
  selectedIngredients,
  ingredientQuantities,
  onSelectionChange,
  onQuantityChange,
  onChoice,
  currentLanguage,
}: Readonly<IngredientStepsBodyProps>) {
  const detailedIngredients = [...ingredients];

  if (step.kind === 'ingredients') {
    return (
      <OptionalIngredientsSection
        ingredients={detailedIngredients}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={ingredientQuantities}
        onSelectionChange={onSelectionChange}
        onQuantityChange={onQuantityChange}
        currentLanguage={currentLanguage}
        sauceGroup={sauceGroup}
        headless
        includeSauces={false}
      />
    );
  }

  if (step.kind === 'sauces') {
    return (
      <SauceGroupSection
        ingredients={detailedIngredients}
        rule={toSauceGroupRule(sauceGroup)}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={ingredientQuantities}
        onSelectionChange={(selected) => {
          onSelectionChange(selected);
          // Not when a chosen sauce still has a quantity to set: its stepper renders only while the
          // row is selected, so advancing would carry the guest past a control that just appeared.
          if (!selected.some((id) => hasQuantityStepper(detailedIngredients, id))) onChoice();
        }}
        onQuantityChange={onQuantityChange}
        currentLanguage={currentLanguage}
        variant="plain"
      />
    );
  }

  return null;
}

/** A selected row shows a stepper only above `maxQuantity` 1 — and only while it is selected. */
function hasQuantityStepper(ingredients: readonly { id: string; maxQuantity?: number }[], id: string): boolean {
  return (ingredients.find((ingredient) => ingredient.id === id)?.maxQuantity ?? 1) > 1;
}
