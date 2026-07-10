'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { CartItem } from '@/components/cart/cartTypes';
import styles from '@/app/styles/CartPage.module.css';

interface CartItemCustomizationsProps {
  item: CartItem;
}

/**
 * The read-only customizations summary for a cart item (added/removed ingredients, side items,
 * special requests). Renders nothing when the item has no customizations. Extracted verbatim from
 * app/cart/page.tsx (Sprint 4/6 god-file decomposition).
 */
export default function CartItemCustomizations({ item }: CartItemCustomizationsProps) {
  const { t } = useTranslation();

  if (!(
    item.selectedIngredientNames?.length ||
    item.excludedIngredientNames?.length ||
    item.selectedSideItems?.length ||
    item.specialInstructions
  )) {
    return null;
  }

  return (
    <div className={styles.customizationsContainer}>
      <h4 className={styles.customizationsTitle}>{t('customizations', 'Customizations')}:</h4>

      {item.selectedIngredientNames && item.selectedIngredientNames.length > 0 && (
        <div className={styles.customizationDetail}>
          <span className={styles.customizationLabel}>{t('added_ingredients', 'Added')}:</span>
          <span className={styles.customizationValue}>
            {item.selectedIngredientNames.map((name, idx) => {
              const ingredientId = item.selectedIngredients?.[idx];
              const qty =
                ingredientId && item.ingredientQuantities?.[ingredientId] ? item.ingredientQuantities[ingredientId] : 1;
              return (
                <span key={idx}>
                  {idx > 0 && ', '}
                  {name}
                  {qty > 1 && ` × ${qty}`}
                </span>
              );
            })}
          </span>
        </div>
      )}

      {item.excludedIngredientNames && item.excludedIngredientNames.length > 0 && (
        <div className={styles.customizationDetail}>
          <span className={styles.customizationLabel}>{t('removed_ingredients', 'Removed')}:</span>
          <span className={styles.customizationValue}>{item.excludedIngredientNames.join(', ')}</span>
        </div>
      )}

      {item.selectedSideItems && item.selectedSideItems.length > 0 && (
        <div className={styles.customizationDetail}>
          <span className={styles.customizationLabel}>{t('side_items', 'Side Items')}:</span>
          <span className={styles.customizationValue}>
            {item.selectedSideItems.map((sideItem, idx) => (
              <span key={sideItem.id}>
                {sideItem.name} x{sideItem.quantity} ({formatPlainCurrency(sideItem.subTotal)})
                {idx < item.selectedSideItems!.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {item.specialInstructions && (
        <div className={styles.customizationDetail}>
          <span className={styles.customizationLabel}>{t('special_requests', 'Special Requests')}:</span>
          <span className={styles.customizationValue}>{item.specialInstructions}</span>
        </div>
      )}
    </div>
  );
}
