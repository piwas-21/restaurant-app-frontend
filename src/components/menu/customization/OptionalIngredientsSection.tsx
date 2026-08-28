'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SauceGroupSection from './SauceGroupSection';
import { isSauce, toSauceGroupRule } from '@/utils/sauceGroup';
import type { ProductIngredient, SauceGroupCarrier } from '@/types/menu';
import styles from './OptionalIngredientsSection.module.css';

interface OptionalIngredientsSectionProps {
  ingredients: ProductIngredient[];
  selectedIngredients: string[];
  ingredientQuantities: Record<string, number>;
  onSelectionChange: (selected: string[]) => void;
  onQuantityChange: (ingredientId: string, quantity: number) => void;
  currentLanguage: string;
  /**
   * The owning product's sauce group rule, straight off the wire (S6). Absent — a bundle option
   * served by a backend that predates the field, or a product with no rule — degrades to "no
   * minimum, no cap, nothing free", which is exactly how sauces priced before S6.
   */
  sauceGroup?: SauceGroupCarrier;
}

export default function OptionalIngredientsSection({
  ingredients,
  selectedIngredients,
  ingredientQuantities,
  onSelectionChange,
  onQuantityChange,
  currentLanguage,
  sauceGroup,
}: OptionalIngredientsSectionProps) {
  const { t } = useTranslation();

  // Filter active ingredients. Sauces are ingredients too (S5's `kind` discriminator), but they are
  // rendered by their own group below and must not appear twice.
  const activeIngredients = ingredients.filter((ing) => ing.isActive && !isSauce(ing));

  // Separate optional and default ingredients
  const defaultIngredients = activeIngredients.filter((ing) => !ing.isOptional);
  const optionalIngredients = activeIngredients.filter((ing) => ing.isOptional);
  const hasSauces = ingredients.some((ing) => ing.isActive && isSauce(ing));

  if (activeIngredients.length === 0 && !hasSauces) {
    return null;
  }

  // The one deselect path, shared by the checkbox and by the stepper's minus at quantity 1.
  //
  // Deselection records an explicit quantity 0 (not 1) so the removal survives into the basket
  // payload and the kitchen ticket can print "NO xxx" — the backend derives IsRemoved from
  // quantity 0 (issue #150), and it lets an explicit client quantity win (verbatim for a regular
  // line, over the backfill for a bundle child), so a 1 here silently re-added the ingredient to
  // the ticket.
  // Price and rendering are unaffected, because a deselected ingredient's quantity is never read:
  // pricing only consults it on the selected branches (utils/linePrice.ts), and the quantity
  // stepper renders only while `isSelected`.
  const deselect = (ingredientId: string) => {
    onSelectionChange(selectedIngredients.filter((id) => id !== ingredientId));
    onQuantityChange(ingredientId, 0);
  };

  const handleToggle = (ingredientId: string, isOptional: boolean) => {
    // Non-optional ingredients cannot be deselected
    if (!isOptional) {
      return;
    }

    if (selectedIngredients.includes(ingredientId)) {
      deselect(ingredientId);
    } else {
      onSelectionChange([...selectedIngredients, ingredientId]);
      // Default quantity is 1 when selected
      onQuantityChange(ingredientId, 1);
    }
  };

  const handleQuantityChange = (e: React.MouseEvent, ingredientId: string, change: number, max: number) => {
    e.preventDefault();
    e.stopPropagation();

    const currentQty = ingredientQuantities[ingredientId] || 1;
    const newQty = currentQty + change;

    // Minus at 1 removes the ingredient instead of dead-ending on a disabled button: it drops to 0
    // AND unticks, through the very same deselect the checkbox uses, so the quantity-0 "NO xxx"
    // convention still holds (F5).
    if (newQty <= 0) {
      deselect(ingredientId);
      return;
    }

    if (newQty <= max) {
      onQuantityChange(ingredientId, newQty);
    }
  };

  // Get ingredient name in current language
  const getIngredientName = (ingredient: ProductIngredient) => {
    return ingredient.content?.[currentLanguage]?.name || ingredient.content?.en?.name || ingredient.name;
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('customize_ingredients')}</h3>

      {/* Default Ingredients (always included, can be excluded) */}
      {defaultIngredients.length > 0 && (
        <div className={styles.ingredientGroup}>
          <h4 className={styles.groupTitle}>{t('ingredient_included')}</h4>
          <div className={styles.ingredientList}>
            {defaultIngredients.map((ingredient) => (
              <label key={ingredient.id} className={styles.ingredientItem}>
                <input
                  type="checkbox"
                  checked={selectedIngredients.includes(ingredient.id)}
                  onChange={() => handleToggle(ingredient.id, ingredient.isOptional)}
                  disabled={!ingredient.isOptional}
                  className={styles.checkbox}
                />
                {/* tenant-authored: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
                <span dir="auto" className={styles.ingredientName}>
                  {getIngredientName(ingredient)}
                </span>
                {ingredient.price > 0 && (
                  <span className={styles.ingredientPrice}>+{formatPlainCurrency(ingredient.price)}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Optional Ingredients (can be added) */}
      {optionalIngredients.length > 0 && (
        <div className={styles.ingredientGroup}>
          <h4 className={styles.groupTitle}>{t('ingredient_optional')}</h4>
          <div className={styles.ingredientList}>
            {optionalIngredients.map((ingredient) => {
              const isSelected = selectedIngredients.includes(ingredient.id);
              const maxQty = ingredient.maxQuantity || 1;
              const showQuantityControls = isSelected && maxQty > 1;
              const currentQty = ingredientQuantities[ingredient.id] || 1;

              return (
                <div key={ingredient.id} className={styles.ingredientItemWrapper}>
                  <label className={styles.ingredientItem}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(ingredient.id, ingredient.isOptional)}
                      className={styles.checkbox}
                    />
                    <div className={styles.ingredientInfo}>
                      <span dir="auto" className={styles.ingredientName}>
                        {getIngredientName(ingredient)}
                      </span>
                      {ingredient.price > 0 && (
                        <span className={styles.ingredientPrice}>
                          {ingredient.isIncludedInBasePrice
                            ? isSelected
                              ? '' // Already in base price, no indicator needed
                              : `-${formatPlainCurrency(ingredient.price)}` // Deducted when deselected
                            : `+${formatPlainCurrency(ingredient.price)}`}{' '}
                          {/* Added when selected */}
                        </span>
                      )}
                    </div>
                  </label>

                  {showQuantityControls && (
                    <div className={styles.quantityControls}>
                      <button
                        type="button"
                        className={styles.quantityBtn}
                        onClick={(e) => handleQuantityChange(e, ingredient.id, -1, maxQty)}
                      >
                        -
                      </button>
                      <span className={styles.quantityValue}>{currentQty}</span>
                      <button
                        type="button"
                        className={styles.quantityBtn}
                        onClick={(e) => handleQuantityChange(e, ingredient.id, 1, maxQty)}
                        disabled={currentQty >= maxQty}
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
      )}

      {/* Inside this section, deliberately, and not beside it in `ProductSheetBody`: a bundle option
          mounts THIS component directly (`BundleOptionRow`), so a sauces group placed here reaches
          the bundle body for free and can never drift from the product one. */}
      <SauceGroupSection
        ingredients={ingredients}
        rule={toSauceGroupRule(sauceGroup)}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={ingredientQuantities}
        onSelectionChange={onSelectionChange}
        onQuantityChange={onQuantityChange}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}
