'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { DetailedIngredient } from '@/types/menu';
import styles from '../ProductCustomizationInBundle.module.css';

interface CustomizationIngredientsSectionProps {
  detailedIngredients: DetailedIngredient[];
  selectedIngredients: Set<string>;
  ingredientQuantities: Record<string, number>;
  getIngredientName: (ingredient: DetailedIngredient) => string;
  onToggle: (ingredient: DetailedIngredient) => void;
  onQuantityChange: (ingredientId: string, delta: number) => void;
}

/**
 * The included (non-optional) and optional ingredient groups of the bundle customization modal.
 * Extracted verbatim from ProductCustomizationInBundle (Sprint 4/6 god-file decomposition).
 */
export default function CustomizationIngredientsSection({
  detailedIngredients,
  selectedIngredients,
  ingredientQuantities,
  getIngredientName,
  onToggle,
  onQuantityChange,
}: CustomizationIngredientsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.section}>
      <h4>{t('customize_ingredients')}</h4>

      {/* Included Ingredients (non-optional) */}
      {detailedIngredients.filter((ing) => !ing.isOptional).length > 0 && (
        <div className={styles.ingredientGroup}>
          <h5 className={styles.groupTitle}>{t('ingredient_included')}</h5>
          <div className={styles.itemsList}>
            {detailedIngredients
              .filter((ing) => !ing.isOptional)
              .map((ingredient) => {
                const isSelected = selectedIngredients.has(ingredient.id);
                const quantity = ingredientQuantities[ingredient.id] || 1;
                const showQuantity = isSelected && ingredient.maxQuantity > 1;

                return (
                  <div
                    key={ingredient.id}
                    className={`${styles.customizationItem} ${isSelected ? styles.selected : ''} ${styles.disabled}`}
                  >
                    <label className={styles.itemLabel}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(ingredient)}
                        disabled={true}
                        className={styles.checkbox}
                      />
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{getIngredientName(ingredient)}</span>
                        {ingredient.price > 0 && !ingredient.isIncludedInBasePrice && (
                          <span className={styles.itemPrice}>+{formatPlainCurrency(ingredient.price)}</span>
                        )}
                      </div>
                    </label>

                    {showQuantity && (
                      <div className={styles.quantityControl}>
                        <button
                          onClick={() => onQuantityChange(ingredient.id, -1)}
                          disabled={quantity <= 1}
                          className={styles.quantityButton}
                        >
                          −
                        </button>
                        <span className={styles.quantity}>{quantity}</span>
                        <button
                          onClick={() => onQuantityChange(ingredient.id, 1)}
                          disabled={quantity >= ingredient.maxQuantity}
                          className={styles.quantityButton}
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

      {/* Optional Ingredients */}
      {detailedIngredients.filter((ing) => ing.isOptional).length > 0 && (
        <div className={styles.ingredientGroup}>
          <h5 className={styles.groupTitle}>{t('ingredient_optional')}</h5>
          <div className={styles.itemsList}>
            {detailedIngredients
              .filter((ing) => ing.isOptional)
              .map((ingredient) => {
                const isSelected = selectedIngredients.has(ingredient.id);
                const quantity = ingredientQuantities[ingredient.id] || 1;
                const showQuantity = isSelected && ingredient.maxQuantity > 1;

                return (
                  <div
                    key={ingredient.id}
                    className={`${styles.customizationItem} ${isSelected ? styles.selected : ''}`}
                  >
                    <label className={styles.itemLabel}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(ingredient)}
                        className={styles.checkbox}
                      />
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{getIngredientName(ingredient)}</span>
                        {ingredient.price > 0 && (
                          <span className={styles.itemPrice}>
                            {ingredient.isIncludedInBasePrice
                              ? isSelected
                                ? quantity > 1
                                  ? `+${formatPlainCurrency(ingredient.price * (quantity - 1))}` // Show extra cost when quantity > 1
                                  : '' // Quantity 1 is already in base price
                                : `-${formatPlainCurrency(ingredient.price)}` // Deducted when deselected
                              : `+${formatPlainCurrency(ingredient.price * quantity)}`}{' '}
                            {/* Added when selected */}
                          </span>
                        )}
                      </div>
                    </label>

                    {showQuantity && (
                      <div className={styles.quantityControl}>
                        <button
                          onClick={() => onQuantityChange(ingredient.id, -1)}
                          disabled={quantity <= 1}
                          className={styles.quantityButton}
                        >
                          −
                        </button>
                        <span className={styles.quantity}>{quantity}</span>
                        <button
                          onClick={() => onQuantityChange(ingredient.id, 1)}
                          disabled={quantity >= ingredient.maxQuantity}
                          className={styles.quantityButton}
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
    </div>
  );
}
