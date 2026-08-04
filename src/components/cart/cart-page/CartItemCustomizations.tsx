'use client';

import React from 'react';
import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { CartItem } from '@/components/cart/cartTypes';

interface CartItemCustomizationsProps {
  item: CartItem;
  /** Host template's CSS module (the auth "cart pattern"). */
  styles: Readonly<Record<string, string>>;
}

/**
 * The read-only customizations summary for a cart item (added/removed ingredients, side items).
 * Renders nothing when the item has no ingredient/side customizations. Special instructions are
 * owned by CartItemInstructionsEditor (display + edit) for every item, so they are NOT shown here —
 * that avoids a duplicate "special requests" line. Extracted from app/cart/page.tsx (Sprint 4/6).
 */
export default function CartItemCustomizations({ item, styles }: Readonly<CartItemCustomizationsProps>) {
  const { t } = useTranslation();

  if (!(
    item.selectedIngredientNames?.length ||
    item.removedIngredientNames?.length ||
    item.selectedSideItems?.length
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
              // Keyed on the ingredient id, not the index: it is already resolved above, and an
              // index key re-associates state across a reorder (Sonar S6479). The fallback is
              // load-bearing — `selectedIngredients` is optional and can be absent while
              // `selectedIngredientNames` is present — and it is safe because a line's added
              // ingredients are a SET: repeating one raises its quantity (`ingredientQuantities`,
              // keyed by id) rather than appending a second entry. See `order/lineSummary.ts`,
              // which walks the same two index-aligned arrays.
              return (
                <React.Fragment key={ingredientId ?? name}>
                  {idx > 0 && ', '}
                  {/* Separator OUTSIDE the isolate — `dir="auto"` implies `unicode-bidi: isolate`,
                      so a leading `, ` inside it collapses the gap between items to 0px. */}
                  <span dir="auto">{name}</span>
                  {qty > 1 && ` × ${qty}`}
                </React.Fragment>
              );
            })}
          </span>
        </div>
      )}

      {/* Restored with a working source (#363). This block existed until #364 deleted it along
          with `excludedIngredientNames` — correctly, since that field was derived from a column
          nothing ever wrote, so the row could never appear. `.length`, not truthiness: the field
          arrives as an empty array on a line that was customized without removing anything, and a
          truthy test would print an empty "Removed:" label. */}
      {item.removedIngredientNames && item.removedIngredientNames.length > 0 && (
        <div className={styles.customizationDetail}>
          <span className={styles.customizationLabel}>{t('removed_ingredients', 'Removed')}:</span>
          {/* One isolate around the whole joined run, matching OrderLineSummary: these are names
              only, with no per-item quantity to keep outside the isolate. */}
          <span dir="auto" className={styles.customizationValue}>
            {item.removedIngredientNames.join(', ')}
          </span>
        </div>
      )}

      {item.selectedSideItems && item.selectedSideItems.length > 0 && (
        <div className={styles.customizationDetail}>
          <span className={styles.customizationLabel}>{t('side_items', 'Side Items')}:</span>
          <span className={styles.customizationValue}>
            {item.selectedSideItems.map((sideItem, idx) => (
              <React.Fragment key={sideItem.id}>
                <span dir="auto">{sideItem.name}</span> x{sideItem.quantity} ({formatPlainCurrency(sideItem.subTotal)})
                {idx < item.selectedSideItems!.length - 1 ? ', ' : ''}
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
