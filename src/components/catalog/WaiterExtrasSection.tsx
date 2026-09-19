'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { maxIngredientQuantity } from '@/utils/priceableIngredient';
import { isSauce } from '@/utils/sauceGroup';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DetailedIngredient } from './productCustomizationTypes';
import styles from './WaiterExtrasSection.module.css';

/**
 * Which of the three chip states a row is in.
 *
 * `excluded` — struck through and red — is the one that only became reachable with S7: the base
 * recipe had this ingredient and this line does not, which is the same thing the kitchen ticket
 * already says as "NO xxx".
 */
function chipState(isSelected: boolean, isIncludedInBase: boolean): string {
  if (isSelected) return styles.added;
  return isIncludedInBase ? styles.excluded : styles.optional;
}

interface WaiterExtrasSectionProps {
  ingredients: DetailedIngredient[];
  selectedIngredients: ReadonlySet<string>;
  ingredientQuantities: Readonly<Record<string, number>>;
  onToggle: (ingredient: DetailedIngredient) => void;
  onStep: (ingredient: DetailedIngredient, change: number) => void;
  nameOf: (ingredient: DetailedIngredient) => string;
  /** The product's sauce cap (P4); `null` is unbounded. Read for the "Maximum N" sentence. */
  sauceMax: number | null;
  /** Cap spent: unchosen sauce chips are announced disabled, and the hook refuses their toggle. */
  isSauceGroupFull: boolean;
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
  sauceMax,
  isSauceGroupFull,
}: Readonly<WaiterExtrasSectionProps>) {
  const { t } = useTranslation();

  if (ingredients.length === 0) return null;

  // A spent cap above 1 greys the rest and says why — the guest's checkbox group. A cap of 1 is the
  // guest's RADIO: the chips stay live because a tap swaps, so nothing is disabled and nothing is
  // announced. And a cap with no sauce rows to apply to (`sauceMax: 0` on a product that lists none)
  // has nothing to explain, so the badge stays off the way the guest's group returns null.
  const capBlocksChips = isSauceGroupFull && sauceMax !== null && sauceMax > 1 && ingredients.some(isSauce);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('server.extras', 'Extras')}</h3>
      {/* The guest sheet's sentence, on the guest sheet's badge: the same key, the same number. */}
      {capBlocksChips && <StatusBadge tone="danger">{t('sauce_max_reached', { max: sauceMax })}</StatusBadge>}
      <div className={styles.ingredientList}>
        {ingredients.map((ingredient) => {
          const isSelected = selectedIngredients.has(ingredient.id);
          const isIncluded = ingredient.isIncludedInBasePrice === true;
          const price = ingredient.price ?? 0;
          const max = maxIngredientQuantity(ingredient);
          const currentQuantity = ingredientQuantities[ingredient.id] ?? 1;
          const showStepper = isSelected && max > 1;
          const state = chipState(isSelected, isIncluded);
          // aria-disabled, not disabled, for the same reason as the stepper below: the chip keeps
          // its place in the tab order and a screen reader can say the maximum has been reached.
          const isCappedSauce = capBlocksChips && !isSelected && isSauce(ingredient);

          return (
            <div key={ingredient.id} className={styles.ingredientItem}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-disabled={isCappedSauce || undefined}
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
