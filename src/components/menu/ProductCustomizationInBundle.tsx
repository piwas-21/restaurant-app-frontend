import React from 'react';
import styles from './ProductCustomizationInBundle.module.css';
import { DetailedIngredient, MenuSectionSuggestedSideItem } from '@/types/menu';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/components/LanguageSwitcher';
import { useProductCustomization, type ProductCustomization } from '@/hooks/menu/useProductCustomization';
import CustomizationIngredientsSection from './bundle-customization/CustomizationIngredientsSection';
import CustomizationSideItemsSection from './bundle-customization/CustomizationSideItemsSection';

export type { ProductCustomization };

interface ProductCustomizationInBundleProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  basePrice: number;
  detailedIngredients?: DetailedIngredient[];
  suggestedSideItems?: MenuSectionSuggestedSideItem[];
  onConfirm: (customization: ProductCustomization) => void;
  initialCustomization?: ProductCustomization;
  currentLanguage: LanguageCode;
}

const ProductCustomizationInBundle: React.FC<ProductCustomizationInBundleProps> = ({
  isOpen,
  onClose,
  productName,
  basePrice,
  detailedIngredients = [],
  suggestedSideItems = [],
  onConfirm,
  initialCustomization,
  currentLanguage,
}) => {
  const { t } = useTranslation();
  const {
    selectedIngredients,
    ingredientQuantities,
    selectedSideItems,
    specialInstructions,
    setSpecialInstructions,
    getIngredientName,
    handleIngredientToggle,
    handleIngredientQuantityChange,
    handleSideItemToggle,
    handleSideItemQuantityChange,
    handleConfirm,
    totalPrice,
    hasCustomizableItems,
  } = useProductCustomization({
    isOpen,
    basePrice,
    detailedIngredients,
    suggestedSideItems,
    initialCustomization,
    currentLanguage,
    onConfirm,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{productName}</h3>
          <button onClick={onClose} className={styles.closeButton} aria-label={t('close')}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.priceDisplay}>
            <span>{t('base_price')}:</span>
            <span className={styles.price}>CHF {basePrice.toFixed(2)}</span>
          </div>

          {!hasCustomizableItems && <p className={styles.noCustomization}>{t('no_customization_available')}</p>}

          {detailedIngredients.length > 0 && (
            <CustomizationIngredientsSection
              detailedIngredients={detailedIngredients}
              selectedIngredients={selectedIngredients}
              ingredientQuantities={ingredientQuantities}
              getIngredientName={getIngredientName}
              onToggle={handleIngredientToggle}
              onQuantityChange={handleIngredientQuantityChange}
            />
          )}

          {suggestedSideItems.length > 0 && (
            <CustomizationSideItemsSection
              suggestedSideItems={suggestedSideItems}
              selectedSideItems={selectedSideItems}
              onToggle={handleSideItemToggle}
              onQuantityChange={handleSideItemQuantityChange}
            />
          )}

          {/* Special Instructions */}
          <div className={styles.section}>
            <h4>{t('special_instructions')}</h4>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder={t('add_special_instructions')}
              className={styles.textarea}
              rows={3}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.totalPrice}>
            <span>{t('total')}:</span>
            <span className={styles.price}>CHF {totalPrice.toFixed(2)}</span>
          </div>
          <button onClick={handleConfirm} className={styles.confirmButton}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCustomizationInBundle;
