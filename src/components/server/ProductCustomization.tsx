import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Product } from '@/services/serverService';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import BaseModal from '@/components/design-system/BaseModal';
import { useProductCustomizationSheet } from './useProductCustomizationSheet';
import WaiterExtrasSection from './WaiterExtrasSection';
import type {
  CustomizationResult,
  DetailedIngredient,
  ProductVariation,
  SuggestedSideItem,
} from './productCustomizationTypes';
import styles from './ProductCustomization.module.css';
import { groupSuggestedSideItems } from '@/utils/suggestedSideItems';

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
 *
 * S7 put it on `BaseModal` (CLAUDE.md §5 rule 2), which it had never used: the hand-rolled overlay
 * it replaces had no `role="dialog"`, no ESC, no focus move and no scroll lock. The layout is
 * otherwise unchanged — a waiter is entering an order at speed and this screen must stay fast.
 */
export default function ProductCustomization({ product, isOpen, onClose, onConfirm }: ProductCustomizationProps) {
  const { t } = useTranslation();
  const sheet = useProductCustomizationSheet({ product, isOpen, onClose, onConfirm });

  // Four flat branches rather than a ternary chain: the failure one is the point of the block, and
  // burying it two levels into a nested `?:` is how it stayed unwritten for as long as it did.
  const showEmpty = !sheet.isLoading && !sheet.error && !sheet.hasCustomizations;
  const showOptions = !sheet.isLoading && !sheet.error && sheet.hasCustomizations;

  const footer = (
    <div className={styles.footerRow}>
      <div className={styles.quantityControl}>
        <button
          type="button"
          className={styles.qtyButton}
          aria-label={t('decrease_quantity', 'Decrease quantity')}
          onClick={() => sheet.setQuantity(Math.max(1, sheet.quantity - 1))}
        >
          −
        </button>
        <span className={styles.qtyValue}>{sheet.quantity}</span>
        <button
          type="button"
          className={styles.qtyButton}
          aria-label={t('increase_quantity', 'Increase quantity')}
          onClick={() => sheet.setQuantity(sheet.quantity + 1)}
        >
          +
        </button>
      </div>
      <button type="button" className={styles.confirmButton} onClick={sheet.handleConfirm}>
        {t('server.add_to_order', 'Add to Order')} · {formatPlainCurrency(sheet.totalPrice)}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={product.name} size="lg" footer={footer}>
      {/* The base price lost its slot in the header when BaseModal took the title over; it belongs
          with the options it is the starting point for, not beside the name. */}
      <p className={styles.basePrice}>{formatPlainCurrency(product.basePrice)}</p>

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
                    type="button"
                    key={variation.id}
                    aria-pressed={sheet.selectedVariation?.id === variation.id}
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

          {/* Standard Ingredients — required, so read-only on every surface. */}
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

          <WaiterExtrasSection
            ingredients={sheet.optionalIngredients}
            selectedIngredients={sheet.selectedIngredients}
            ingredientQuantities={sheet.ingredientQuantities}
            onToggle={sheet.toggleIngredient}
            onStep={sheet.stepIngredient}
            nameOf={sheet.getLocalizedName}
            sauceMax={sheet.sauceMax}
            isSauceGroupFull={sheet.isSauceGroupFull}
          />

          {/* Side items keep their established selections and payload; P2 only partitions their presentation. */}
          {groupSuggestedSideItems(sheet.sideItems).map((group) => (
            <div key={group.id} className={styles.section}>
              <h3 className={styles.sectionTitle}>{t(group.translationKey)}</h3>
              <div className={styles.sideItemList}>
                {group.items.map((side: SuggestedSideItem) => (
                  <button
                    type="button"
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
          ))}

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
    </BaseModal>
  );
}
