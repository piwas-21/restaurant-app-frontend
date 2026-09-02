'use client';

import React from 'react';
import { formatPlainCurrency } from '@/utils/currency';
import ChoiceGroupIndicator from './ChoiceGroupIndicator';
import type { ProductIngredient } from '@/types/menu';
import styles from './OptionalIngredientsSection.module.css';

interface OptionalIngredientRowProps {
  ingredient: ProductIngredient;
  name: string;
  isSelected: boolean;
  /** This row replaces a sibling when picked (§9) — marked, so the swap is not a surprise. */
  isChoiceMember: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (event: React.MouseEvent, change: number, max: number) => void;
}

/**
 * One optional ingredient — its checkbox, its price marker and (above `maxQuantity` 1) its stepper.
 *
 * Extracted from `OptionalIngredientsSection` when the guided flow added the `headless` and
 * `includeSauces` props (MENU-CUSTOMIZATION-FLOW-PLAN slice 1) and pushed that file past its §4
 * length limit. Markup and behaviour are verbatim; it shares the parent's stylesheet so the rows
 * cannot drift apart visually.
 */
export default function OptionalIngredientRow({
  ingredient,
  name,
  isSelected,
  isChoiceMember,
  quantity,
  onToggle,
  onQuantityChange,
}: Readonly<OptionalIngredientRowProps>) {
  const maxQuantity = ingredient.maxQuantity || 1;
  const showQuantityControls = isSelected && maxQuantity > 1;
  const priceMarker = priceMarkerFor(ingredient, isSelected);

  return (
    <div className={styles.ingredientItemWrapper}>
      <label className={styles.ingredientItem}>
        <input type="checkbox" checked={isSelected} onChange={onToggle} className={styles.checkbox} />
        <div className={styles.ingredientInfo}>
          {/* tenant-authored: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
          <span dir="auto" className={styles.ingredientName}>
            {name}
          </span>
          {isChoiceMember && <ChoiceGroupIndicator kind="badge" />}
          {ingredient.price > 0 && <span className={styles.ingredientPrice}>{priceMarker} </span>}
        </div>
      </label>

      {showQuantityControls && (
        <div className={styles.quantityControls}>
          <button
            type="button"
            className={styles.quantityBtn}
            onClick={(event) => onQuantityChange(event, -1, maxQuantity)}
          >
            -
          </button>
          <span className={styles.quantityValue}>{quantity}</span>
          <button
            type="button"
            className={styles.quantityBtn}
            onClick={(event) => onQuantityChange(event, 1, maxQuantity)}
            disabled={quantity >= maxQuantity}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * What the row says about money. Three cases, and the middle one is the surprising one: an
 * ingredient already paid for in the base price shows nothing while it is ticked, and a REFUND when
 * the guest removes it.
 */
function priceMarkerFor(ingredient: ProductIngredient, isSelected: boolean): string {
  if (!ingredient.isIncludedInBasePrice) return `+${formatPlainCurrency(ingredient.price)}`;
  return isSelected ? '' : `-${formatPlainCurrency(ingredient.price)}`;
}
