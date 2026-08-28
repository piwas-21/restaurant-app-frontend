'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { maxIngredientQuantity } from '@/utils/priceableIngredient';
import type { DetailedIngredient } from './productCustomizationTypes';
import styles from './WaiterExtrasSection.module.css';

interface WaiterExtrasSectionProps {
  ingredients: DetailedIngredient[];
  selectedIngredients: ReadonlySet<string>;
  ingredientQuantities: Readonly<Record<string, number>>;
  onToggle: (ingredient: DetailedIngredient) => void;
  onStep: (ingredient: DetailedIngredient, change: number) => void;
  nameOf: (ingredient: DetailedIngredient) => string;
}

/**
 * The optional-ingredient row of the waiter's sheet (S7).
 *
 * Its own component so `ProductCustomization` stays a flat render under the §4 limit, and because
 * this is the block that gained all of S7's behaviour: an ingredient the base price already bought
 * now opens TICKED and can be un-ticked (which is how a waiter finally enters "no onion"), and one
 * with a `maxQuantity` above 1 gets the stepper the guest sheet has always had.
 *
 * It stays a chip grid rather than becoming the guest sheet's checkbox list on purpose: a waiter is
 * entering an order at speed at a table, and one tap per extra is the whole point of the screen.
 * The price suffix carries the meaning the layout no longer has to:
 *   included in the base and on  → no suffix (it costs nothing; it is what "included" means)
 *   included in the base and off → −price (the line is cheaper than advertised)
 *   a paid extra                 → +price
 */
export default function WaiterExtrasSection({
  ingredients,
  selectedIngredients,
  ingredientQuantities,
  onToggle,
  onStep,
  nameOf,
}: WaiterExtrasSectionProps) {
  const { t } = useTranslation();

  if (ingredients.length === 0) return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('server.extras', 'Extras')}</h3>
      <div className={styles.ingredientList}>
        {ingredients.map((ingredient) => {
          const isSelected = selectedIngredients.has(ingredient.id);
          const isIncluded = ingredient.isIncludedInBasePrice === true;
          const price = ingredient.price ?? 0;
          const max = maxIngredientQuantity(ingredient);
          const currentQuantity = ingredientQuantities[ingredient.id] ?? 1;
          const showStepper = isSelected && max > 1;
          // Removed = the base recipe had it and this line does not. Struck through and red, which
          // is the vocabulary the kitchen ticket's "NO xxx" already uses.
          const state = isSelected ? styles.added : isIncluded ? styles.excluded : styles.optional;

          return (
            <div key={ingredient.id} className={styles.ingredientItem}>
              <button
                type="button"
                aria-pressed={isSelected}
                className={`${styles.ingredientButton} ${state}`}
                onClick={() => onToggle(ingredient)}
              >
                {isSelected && <span className={styles.addIcon}>✓</span>}
                {/* tenant-authored: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
                <span dir="auto">{nameOf(ingredient)}</span>
                {price > 0 && !(isIncluded && isSelected) && (
                  <span className={styles.ingredientPrice}>
                    {isIncluded ? '−' : '+'}
                    {formatPlainCurrency(price)}
                  </span>
                )}
              </button>

              {showStepper && (
                <div className={styles.quantityControls}>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    aria-label={t('decrease_quantity_of_item', { itemName: nameOf(ingredient) })}
                    onClick={() => onStep(ingredient, -1)}
                  >
                    −
                  </button>
                  <span className={styles.quantityValue}>{currentQuantity}</span>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    aria-label={t('increase_quantity_of_item', { itemName: nameOf(ingredient) })}
                    // aria-disabled, not disabled: the control keeps its place in the tab order and
                    // a screen reader can still announce that the maximum has been reached.
                    aria-disabled={currentQuantity >= max}
                    onClick={() => currentQuantity < max && onStep(ingredient, 1)}
                  >
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
