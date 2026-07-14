'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import BaseModal from '@/components/design-system/BaseModal';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import VariationsSection from '@/components/menu/customization/VariationsSection';
import OptionalIngredientsSection from '@/components/menu/customization/OptionalIngredientsSection';
import SuggestedSideItemsSection from '@/components/menu/customization/SuggestedSideItemsSection';
import SpecialRequestSection from '@/components/menu/customization/SpecialRequestSection';
import type { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import styles from './ItemCustomizationSheet.module.css';

type SheetController = ReturnType<typeof useItemCustomizationSheet>;

/**
 * The single customer product-customization surface (menu-bundles redesign #175, slice 6) — a
 * `BaseModal`-based sheet that replaces `CustomizationModal` + `ProductDetailsModal` for the product
 * catalog. Composes the existing customization sections, prices live via the shared `useLinePrice`
 * (through the controller hook), and gates a sticky "Add • CHF X" footer. Bundle bodies + featured
 * specials migrate onto this sheet in the following slice-6 increment.
 */
export default function ItemCustomizationSheet({ controller }: { controller: SheetController }) {
  const { t } = useTranslation();
  const {
    isOpen,
    product,
    currentLanguage,
    quantity,
    setQuantity,
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
    linePrice,
    addToCart,
    close,
  } = controller;

  if (!isOpen || !product) return null;

  const productName = product.content?.[currentLanguage]?.name || product.content?.en?.name || product.name;
  const description = product.content?.[currentLanguage]?.description || product.content?.en?.description;

  const footer = (
    <div className={styles.footer}>
      <div className={styles.quantityStepper} aria-label={t('quantity')}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
          aria-label={t('decrease_quantity', 'Decrease quantity')}
        >
          <Minus size={16} />
        </button>
        <span className={styles.quantityValue}>{quantity}</span>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => setQuantity(quantity + 1)}
          aria-label={t('increase_quantity', 'Increase quantity')}
        >
          <Plus size={16} />
        </button>
      </div>
      <button type="button" className={styles.addButton} onClick={addToCart}>
        {t('add_to_order')} • {formatPlainCurrency(linePrice.total)}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={productName} size="lg" footer={footer}>
      <div className={styles.body}>
        {description && <p className={styles.description}>{description}</p>}
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
            productName={productName}
          />
        )}

        {product.detailedIngredients && product.detailedIngredients.length > 0 && (
          <OptionalIngredientsSection
            ingredients={product.detailedIngredients}
            selectedIngredients={selectedIngredients}
            ingredientQuantities={ingredientQuantities}
            onSelectionChange={setSelectedIngredients}
            onQuantityChange={(ingredientId, qty) =>
              setIngredientQuantities({ ...ingredientQuantities, [ingredientId]: qty })
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

        <SpecialRequestSection
          specialInstructions={specialInstructions}
          onInstructionsChange={setSpecialInstructions}
        />
      </div>
    </BaseModal>
  );
}
