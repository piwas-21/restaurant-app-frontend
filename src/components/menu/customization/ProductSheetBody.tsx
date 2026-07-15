'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import VariationsSection from './VariationsSection';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import SuggestedSideItemsSection from './SuggestedSideItemsSection';
import SpecialRequestSection from './SpecialRequestSection';
import type { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import styles from './ProductSheetBody.module.css';

export type ProductSheetController = ReturnType<typeof useItemCustomizationSheet>;

/**
 * The single-product body of `ItemCustomizationSheet` — variations, ingredients, suggested sides and
 * a special request. Extracted verbatim from the sheet when the bundle body joined it (menu-bundles
 * redesign #175, slice 6).
 */
export default function ProductSheetBody({ controller }: Readonly<{ controller: ProductSheetController }>) {
  const { t } = useTranslation();
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

      {/* The last thing the retired `ProductDetailsModal` showed that the sheet did not. Everything
          else it listed read-only — ingredients, allergens, variations with their prices, suggested
          sides — the sections below render interactively. */}
      {(product.preparationTimeMinutes ?? 0) > 0 && (
        <p className={styles.preparationTime}>
          {t('preparation_time')}: {product.preparationTimeMinutes} {t('minutes')}
        </p>
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
