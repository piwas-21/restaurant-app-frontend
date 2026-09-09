'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import type { MenuSectionItem } from '@/types/menu';
import styles from './BundleOptionRow.module.css';

interface BundleOptionRowProps {
  item: MenuSectionItem;
  sectionId: string;
  /** `radio` for a single-choice section, `checkbox` otherwise. */
  inputType: 'radio' | 'checkbox';
  isSelected: boolean;
  /** The section is at its `maxSelection` and this option is not one of the picks. */
  isDisabled: boolean;
  currentLanguage: string;
  onToggle: () => void;
  /**
   * Raised when the guest taps "Customize" on a selected option that has ingredients. What it
   * opens is the parent's business: the guest sheet navigates to the option's guided screen
   * (BundleOptionCustomizationScreen — the 2026-09 owner decision that supersedes #175's inline
   * drill-in); the staff modal expands its inline panel. Absent ⇒ no affordance.
   */
  onCustomize?: () => void;
  /**
   * Disclosure state for a parent that expands INLINE (the staff modal). Absent on the guest
   * sheet, whose Customize navigates rather than discloses — an aria-expanded would promise a
   * panel on this row that never appears.
   */
  customizeExpanded?: boolean;
  /** The inline panel's id, for `aria-controls` in the same disclosure mode. */
  customizePanelId?: string;
  /** A required one-option `Plat` stays in the payload but needs no radio or disclosure. */
  hideSelectionControl?: boolean;
}

/**
 * One choosable option inside a bundle section. The row carries the pick, the summary and — for a
 * selected option with ingredients — the Customize affordance. It hosts NO panel: the old inline
 * drill-in (#175, slice 6) became the guided per-option screen in the guest sheet and the
 * extracted `BundleOptionInlinePanel` in the staff modal.
 */
export default function BundleOptionRow({
  item,
  sectionId,
  inputType,
  isSelected,
  isDisabled,
  currentLanguage,
  onToggle,
  onCustomize,
  customizeExpanded,
  customizePanelId,
  hideSelectionControl = false,
}: Readonly<BundleOptionRowProps>) {
  const { t } = useTranslation();

  const ingredients = item.detailedIngredients ?? [];
  const canCustomize = isSelected && ingredients.length > 0;

  const ingredientSummary = ingredients.length
    ? ingredients.map((ing) => ing.content?.[currentLanguage]?.name || ing.content?.en?.name || ing.name).join(', ')
    : (item.ingredients ?? []).join(', ');

  const details = (
    <div className={styles.details}>
      <div className={styles.header}>
        <span className={styles.name}>{item.productName}</span>
        {item.additionalPrice > 0 && <span className={styles.price}>+{formatPlainCurrency(item.additionalPrice)}</span>}
      </div>
      {ingredientSummary && <div className={styles.ingredients}>{ingredientSummary}</div>}
      {item.allergens && item.allergens.length > 0 && (
        <AllergenDisplay allergens={item.allergens} variant="compact" maxVisible={5} showLabel={false} />
      )}
    </div>
  );

  return (
    <div className={styles.option}>
      {hideSelectionControl ? (
        <div className={`${styles.row} ${styles.selected}`}>{details}</div>
      ) : (
        <label className={`${styles.row} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}>
          <input
            type={inputType}
            name={`bundle-section-${sectionId}`}
            checked={isSelected}
            onChange={onToggle}
            disabled={isDisabled}
            className={styles.input}
          />
          {details}
        </label>
      )}

      {canCustomize && onCustomize && (
        <button
          type="button"
          className={styles.customizeButton}
          onClick={onCustomize}
          aria-expanded={customizeExpanded}
          aria-controls={customizeExpanded !== undefined ? customizePanelId : undefined}
        >
          {t('customize')}
        </button>
      )}
    </div>
  );
}
