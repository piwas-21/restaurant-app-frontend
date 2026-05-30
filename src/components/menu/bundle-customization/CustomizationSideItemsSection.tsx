'use client';

import { useTranslation } from 'react-i18next';
import { MenuSectionSuggestedSideItem } from '@/types/menu';
import styles from '../ProductCustomizationInBundle.module.css';

interface CustomizationSideItemsSectionProps {
  suggestedSideItems: MenuSectionSuggestedSideItem[];
  selectedSideItems: Map<string, number>;
  onToggle: (sideItem: MenuSectionSuggestedSideItem) => void;
  onQuantityChange: (sideId: string, delta: number) => void;
}

/**
 * The suggested side-items group of the bundle customization modal. Extracted verbatim from
 * ProductCustomizationInBundle (Sprint 4/6 god-file decomposition).
 */
export default function CustomizationSideItemsSection({
  suggestedSideItems,
  selectedSideItems,
  onToggle,
  onQuantityChange,
}: CustomizationSideItemsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.section}>
      <h4>{t('side_items')}</h4>
      <div className={styles.itemsList}>
        {suggestedSideItems.map((sideItem) => {
          const isSelected = selectedSideItems.has(sideItem.id);
          const quantity = selectedSideItems.get(sideItem.id) || 1;

          return (
            <div key={sideItem.id} className={styles.customizationItem}>
              <label className={styles.itemLabel}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(sideItem)}
                  className={styles.checkbox}
                />
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>
                    {sideItem.sideItemProductName}
                    {sideItem.isRequired && <span className={styles.requiredBadge}>{t('required')}</span>}
                  </span>
                  <span className={styles.itemPrice}>+CHF {sideItem.sideItemBasePrice.toFixed(2)}</span>
                </div>
              </label>

              {isSelected && (
                <div className={styles.quantityControl}>
                  <button
                    onClick={() => onQuantityChange(sideItem.id, -1)}
                    disabled={quantity <= 1}
                    className={styles.quantityButton}
                  >
                    −
                  </button>
                  <span className={styles.quantity}>{quantity}</span>
                  <button onClick={() => onQuantityChange(sideItem.id, 1)} className={styles.quantityButton}>
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
