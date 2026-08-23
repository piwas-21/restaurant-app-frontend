import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Product } from '@/services/serverService';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import { useProductCustomizationSheet } from './useProductCustomizationSheet';
import type {
  CustomizationResult,
  DetailedIngredient,
  ProductVariation,
  SuggestedSideItem,
} from './productCustomizationTypes';
import styles from './ProductCustomization.module.css';

// Re-exported so the existing importers (`take-order/useTakeOrder.ts`, `take-order/orderItems.ts`)
// keep their path while the shapes live in one place.
export type {
  CustomizationResult,
  DetailedIngredient,
  LocalizedContent,
  ProductCustomizationDetail,
  ProductVariation,
  SuggestedSideItem,
} from './productCustomizationTypes';

interface ProductCustomizationProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: CustomizationResult) => void;
}

/**
 * The waiter's customization sheet. Render only — what it offers, what is picked and what it costs
 * live in `useProductCustomizationSheet`.
 */
export default function ProductCustomization({ product, isOpen, onClose, onConfirm }: ProductCustomizationProps) {
  const { t } = useTranslation();
  const sheet = useProductCustomizationSheet({ product, isOpen, onClose, onConfirm });

  if (!isOpen) return null;

  // Four flat branches rather than a ternary chain: the failure one is the point of the block, and
  // burying it two levels into a nested `?:` is how it stayed unwritten for as long as it did.
  const showEmpty = !sheet.isLoading && !sheet.error && !sheet.hasCustomizations;
  const showOptions = !sheet.isLoading && !sheet.error && sheet.hasCustomizations;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.productInfo}>
            <h2 className={styles.productName}>{product.name}</h2>
            <span className={styles.basePrice}>{formatPlainCurrency(product.basePrice)}</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {sheet.isLoading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <span>{t('server.loading_options', 'Loading options...')}</span>
            </div>
          )}

          {/* The sheet used to finish loading blank on a failed fetch: no options, no reason. The
              waiter is standing at a table, so the reason comes with the one action that helps. */}
          {!sheet.isLoading && sheet.error && (
            <div className={styles.loadFailure}>
              <p role="alert" data-testid="customization-load-error">
                {sheet.error}
              </p>
              <button type="button" className={styles.retryButton} onClick={() => void sheet.reload()}>
                {t('retry', 'Retry')}
              </button>
            </div>
          )}

          {showEmpty && (
            <div className={styles.noCustomizations}>
              <p>{t('server.no_customizations', 'This product has no customization options')}</p>
            </div>
          )}

          {showOptions && (
            <>
              {/* Variations */}
              {sheet.variations.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>{t('server.select_variation', 'Select Size/Variation')}</h3>
                  <div className={styles.variationList}>
                    {sheet.variations.map((variation: ProductVariation) => (
                      <button
                        key={variation.id}
                        className={`${styles.variationButton} ${sheet.selectedVariation?.id === variation.id ? styles.selected : ''}`}
                        onClick={() => sheet.selectVariation(variation)}
                      >
                        <span className={styles.variationName}>{sheet.getLocalizedName(variation)}</span>
                        <span className={styles.variationPrice}>
                          {formatPlainCurrency(variation.finalPrice)}
                          {variation.priceModifier !== 0 && (
                            <span className={styles.modifier}>
                              ({variation.priceModifier > 0 ? '+' : ''}
                              {variation.priceModifier.toFixed(2)})
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergen Information */}
              {sheet.allergens.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>{t('server.allergens', 'Allergens')}</h3>
                  <AllergenDisplay
                    allergens={sheet.allergens}
                    id={`product-${product.id}`}
                    variant="admin"
                    showLabel={false}
                  />
                </div>
              )}

              {/* Standard Ingredients (read-only info) */}
              {sheet.standardIngredients.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>{t('server.ingredients', 'Ingredients')}</h3>
                  <div className={styles.ingredientList}>
                    {sheet.standardIngredients.map((ing: DetailedIngredient) => (
                      <span key={ing.id} className={styles.ingredientTag}>
                        {sheet.getLocalizedName(ing)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Ingredients (extras) */}
              {sheet.optionalIngredients.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>{t('server.extras', 'Extras')}</h3>
                  <div className={styles.ingredientList}>
                    {sheet.optionalIngredients.map((ing: DetailedIngredient) => (
                      <button
                        key={ing.id}
                        className={`${styles.ingredientButton} ${styles.optional} ${sheet.addedOptionalIngredients.has(ing.id) ? styles.added : ''}`}
                        onClick={() => sheet.toggleOptional(ing.id)}
                      >
                        {sheet.addedOptionalIngredients.has(ing.id) && <span className={styles.addIcon}>✓</span>}
                        {sheet.getLocalizedName(ing)}
                        {ing.price && <span className={styles.ingredientPrice}>+{ing.price.toFixed(2)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Side Items */}
              {sheet.sideItems.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>{t('server.side_items', 'Side Items')}</h3>
                  <div className={styles.sideItemList}>
                    {sheet.sideItems.map((side: SuggestedSideItem) => (
                      <button
                        key={side.id}
                        className={`${styles.sideItemButton} ${sheet.selectedSideItems.has(side.id) ? styles.selected : ''}`}
                        onClick={() => !side.isRequired && sheet.toggleSideItem(side.id)}
                        disabled={side.isRequired}
                      >
                        <span className={styles.sideName}>
                          {side.name}
                          {side.isRequired && <span className={styles.requiredBadge}>*</span>}
                        </span>
                        <span className={styles.sidePrice}>+{formatPlainCurrency(side.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('server.special_instructions', 'Special Instructions')}</h3>
                <textarea
                  className={styles.instructionsInput}
                  placeholder={t('server.instructions_placeholder', 'e.g., Extra spicy, no onions...')}
                  value={sheet.specialInstructions}
                  onChange={(e) => sheet.setSpecialInstructions(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.quantityControl}>
            <button className={styles.qtyButton} onClick={() => sheet.setQuantity(Math.max(1, sheet.quantity - 1))}>
              −
            </button>
            <span className={styles.qtyValue}>{sheet.quantity}</span>
            <button className={styles.qtyButton} onClick={() => sheet.setQuantity(sheet.quantity + 1)}>
              +
            </button>
          </div>
          <button className={styles.confirmButton} onClick={sheet.handleConfirm}>
            {t('server.add_to_order', 'Add to Order')} · {formatPlainCurrency(sheet.totalPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
