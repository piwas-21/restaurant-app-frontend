'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import SpecialRequestSection from './SpecialRequestSection';
import type { MenuSectionItem, SelectedMenuOption } from '@/types/menu';
import styles from './BundleOptionRow.module.css';

interface BundleOptionRowProps {
  item: MenuSectionItem;
  sectionId: string;
  /** `radio` for a single-choice section, `checkbox` otherwise. */
  inputType: 'radio' | 'checkbox';
  isSelected: boolean;
  /** The section is at its `maxSelection` and this option is not one of the picks. */
  isDisabled: boolean;
  isExpanded: boolean;
  /** The live selection state — present only while this option is selected. */
  option?: SelectedMenuOption;
  currentLanguage: string;
  onToggle: () => void;
  onToggleExpanded: () => void;
  onCustomizationChange: (patch: Partial<SelectedMenuOption>) => void;
}

/**
 * One choosable option inside a bundle section, with its ingredient customization inlined behind a
 * "Customize" disclosure (menu-bundles redesign #175, slice 6). The modal this replaces opened a
 * second, nested modal (`ProductCustomizationInBundle`) on top of itself for the same job.
 */
export default function BundleOptionRow({
  item,
  sectionId,
  inputType,
  isSelected,
  isDisabled,
  isExpanded,
  option,
  currentLanguage,
  onToggle,
  onToggleExpanded,
  onCustomizationChange,
}: Readonly<BundleOptionRowProps>) {
  const { t } = useTranslation();

  const ingredients = item.detailedIngredients ?? [];
  const canCustomize = isSelected && ingredients.length > 0;
  const panelId = `bundle-option-panel-${sectionId}-${item.productId}`;

  const ingredientSummary = ingredients.length
    ? ingredients.map((ing) => ing.content?.[currentLanguage]?.name || ing.content?.en?.name || ing.name).join(', ')
    : (item.ingredients ?? []).join(', ');

  return (
    <div className={styles.option}>
      <label className={`${styles.row} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}>
        <input
          type={inputType}
          name={`bundle-section-${sectionId}`}
          checked={isSelected}
          onChange={onToggle}
          disabled={isDisabled}
          className={styles.input}
        />
        <div className={styles.details}>
          <div className={styles.header}>
            <span className={styles.name}>{item.productName}</span>
            {item.additionalPrice > 0 && (
              <span className={styles.price}>+{formatPlainCurrency(item.additionalPrice)}</span>
            )}
          </div>

          {ingredientSummary && <div className={styles.ingredients}>{ingredientSummary}</div>}

          {item.allergens && item.allergens.length > 0 && (
            <AllergenDisplay allergens={item.allergens} variant="compact" maxVisible={5} showLabel={false} />
          )}
        </div>
      </label>

      {canCustomize && (
        <button
          type="button"
          className={styles.customizeButton}
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          aria-controls={panelId}
        >
          {t('customize')}
        </button>
      )}

      {canCustomize && isExpanded && (
        <div className={styles.panel} id={panelId}>
          <OptionalIngredientsSection
            ingredients={ingredients}
            selectedIngredients={option?.selectedIngredients ?? []}
            ingredientQuantities={option?.ingredientQuantities ?? {}}
            onSelectionChange={(selected) => onCustomizationChange({ selectedIngredients: selected })}
            onQuantityChange={(ingredientId, quantity) =>
              onCustomizationChange({
                ingredientQuantities: { ...option?.ingredientQuantities, [ingredientId]: quantity },
              })
            }
            currentLanguage={currentLanguage}
          />
          <SpecialRequestSection
            specialInstructions={option?.specialInstructions ?? ''}
            onInstructionsChange={(instructions) =>
              onCustomizationChange({ specialInstructions: instructions || undefined })
            }
          />
        </div>
      )}
    </div>
  );
}
