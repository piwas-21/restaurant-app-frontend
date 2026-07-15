'use client';

import React from 'react';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import VariationsSection from './VariationsSection';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import SuggestedSideItemsSection from './SuggestedSideItemsSection';
import SpecialRequestSection from './SpecialRequestSection';
import type { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';

export type ProductSheetController = ReturnType<typeof useItemCustomizationSheet>;

/**
 * The single-product body of `ItemCustomizationSheet` — variations, ingredients, suggested sides and
 * a special request. Extracted verbatim from the sheet when the bundle body joined it (menu-bundles
 * redesign #175, slice 6).
 */
export default function ProductSheetBody({ controller }: Readonly<{ controller: ProductSheetController }>) {
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
    specialInstructions,
    setSpecialInstructions,
  } = controller;

  if (!product) return null;

  return (
    <>
      {product.allergens && product.allergens.length > 0 && (
        <AllergenDisplay allergens={product.allergens} variant="compact" maxVisible={8} />
      )}

      {product.variations && product.variations.length > 0 && (
        <VariationsSection
          variations={product.variations}
          selectedVariationId={selectedVariationId}
          onVariationChange={setSelectedVariationId}
          basePrice={product.basePrice}
          currentLanguage={currentLanguage}
          productName={title}
        />
      )}

      {product.detailedIngredients && product.detailedIngredients.length > 0 && (
        <OptionalIngredientsSection
          ingredients={product.detailedIngredients}
          selectedIngredients={selectedIngredients}
          ingredientQuantities={ingredientQuantities}
          onSelectionChange={setSelectedIngredients}
          onQuantityChange={(ingredientId, qty) =>
            setIngredientQuantities((prev) => ({ ...prev, [ingredientId]: qty }))
          }
          currentLanguage={currentLanguage}
        />
      )}

      {product.suggestedSideItems && product.suggestedSideItems.length > 0 && (
        <SuggestedSideItemsSection
          sideItems={product.suggestedSideItems}
          selectedSideItems={selectedSideItems}
          onSelectionChange={setSelectedSideItems}
          currentLanguage={currentLanguage}
        />
      )}

      <SpecialRequestSection specialInstructions={specialInstructions} onInstructionsChange={setSpecialInstructions} />
    </>
  );
}
