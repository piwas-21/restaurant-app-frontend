'use client';

import React from 'react';
import VariationsSection from './VariationsSection';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import SauceGroupSection from './SauceGroupSection';
import SuggestedSideItemsSection from './SuggestedSideItemsSection';
import { toSauceGroupRule } from '@/utils/sauceGroup';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';

export type ProductSheetController = ReturnType<typeof useItemCustomizationSheet>;

interface ProductSheetBodyProps {
  controller: ProductSheetController;
  /** The step on screen. The body renders exactly one — the flow decides which. */
  step: CustomizationStep;
  /** Announces that a single-choice step has been answered, so the flow may advance itself. */
  onChoice: () => void;
}

/**
 * The single-product body of `ItemCustomizationSheet`, as one step at a time
 * (MENU-CUSTOMIZATION-FLOW-PLAN §3).
 *
 * The sections themselves are untouched — same components, same handlers, same payload. What
 * changed is that they no longer share a viewport, which is what removes the trade the old layout
 * was stuck with: it collapsed sauces and every side group by default to keep "Add" above the fold,
 * and paid for it in choices the guest never saw existed.
 */
export default function ProductSheetBody({ controller, step, onChoice }: Readonly<ProductSheetBodyProps>) {
  const {
    product,
    title,
    currentLanguage,
    selectedVariationId,
    setSelectedVariationId,
    selectedIngredients,
    setSelectedIngredients,
    ingredientQuantities,
    setIngredientQuantities,
    selectedSideItems,
    setSelectedSideItems,
  } = controller;

  if (!product) return null;

  const onQuantityChange = (ingredientId: string, quantity: number) =>
    setIngredientQuantities((previous) => ({ ...previous, [ingredientId]: quantity }));

  if (step.kind === 'variations') {
    return (
      <VariationsSection
        variations={product.variations ?? []}
        selectedVariationId={selectedVariationId}
        onVariationChange={(variationId) => {
          setSelectedVariationId(variationId);
          onChoice();
        }}
        basePrice={product.basePrice}
        currentLanguage={currentLanguage}
        productName={title}
        hideBaseProduct={product.hideBaseProduct}
        headless
      />
    );
  }

  if (step.kind === 'ingredients') {
    return (
      <OptionalIngredientsSection
        ingredients={product.detailedIngredients ?? []}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={ingredientQuantities}
        onSelectionChange={setSelectedIngredients}
        onQuantityChange={onQuantityChange}
        currentLanguage={currentLanguage}
        sauceGroup={product}
        headless
        // Sauces are their own step here. Left on, the group would render in BOTH steps at once and
        // each copy could undo the other's selection.
        includeSauces={false}
      />
    );
  }

  if (step.kind === 'sauces') {
    return (
      <SauceGroupSection
        ingredients={product.detailedIngredients ?? []}
        rule={toSauceGroupRule(product)}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={ingredientQuantities}
        onSelectionChange={(selected) => {
          setSelectedIngredients(selected);
          // Not when a chosen sauce still has a quantity to set: its stepper renders only while the
          // row is selected, so advancing would carry the guest past a control that just appeared.
          if (!selected.some((id) => hasQuantityStepper(product.detailedIngredients ?? [], id))) onChoice();
        }}
        onQuantityChange={onQuantityChange}
        currentLanguage={currentLanguage}
        variant="plain"
      />
    );
  }

  if (step.kind === 'sides') {
    return (
      <SuggestedSideItemsSection
        sideItems={product.suggestedSideItems ?? []}
        selectedSideItems={selectedSideItems}
        onSelectionChange={setSelectedSideItems}
        currentLanguage={currentLanguage}
        // `bare` drops the group's own <h3>, because the step panel's title already names the
        // partition ("Add a dessert") and the two said the same thing twice.
        //
        // The pair is DERIVED FROM ONE FACT, deliberately. `sideGroup` is optional on the step
        // type, and `bare` is what turns a missing one from "renders too much" into "renders three
        // unlabelled lists back to back" — a worse screen than the one this fixes, failing silently
        // in the visual AND the accessibility tree. Only `buildProductSteps` makes `sides` steps
        // and it always sets the field, so this is a latent case; deriving both from it means it
        // can only ever degrade to what develop shipped — every partition, each under its own
        // heading — and never to something new.
        variant={step.sideGroup ? 'bare' : 'plain'}
        onlyGroup={step.sideGroup}
      />
    );
  }

  return null;
}

/** A selected row shows a stepper only above `maxQuantity` 1 — and only while it is selected. */
function hasQuantityStepper(ingredients: readonly { id: string; maxQuantity?: number }[], id: string): boolean {
  return (ingredients.find((ingredient) => ingredient.id === id)?.maxQuantity ?? 1) > 1;
}
