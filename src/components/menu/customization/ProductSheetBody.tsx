'use client';

import React from 'react';
import VariationsSection from './VariationsSection';
import IngredientStepsBody from './IngredientStepsBody';
import SuggestedSideItemsSection from './SuggestedSideItemsSection';
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

  if (step.kind === 'ingredients' || step.kind === 'sauces') {
    // The shared ingredient-decisions body — the SAME component the per-option screen inside a
    // bundle sheet renders, which is what keeps a combo's sauces identical to the dish's.
    return (
      <IngredientStepsBody
        sauceGroup={product}
        ingredients={product.detailedIngredients ?? []}
        step={step}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={ingredientQuantities}
        onSelectionChange={setSelectedIngredients}
        onQuantityChange={onQuantityChange}
        onChoice={onChoice}
        currentLanguage={currentLanguage}
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
