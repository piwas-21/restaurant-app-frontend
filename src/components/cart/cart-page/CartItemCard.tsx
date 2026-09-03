'use client';

import { formatPlainCurrency } from '@/utils/currency';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/components/cart/cartTypes';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { basketItemToLineSummary } from '@/components/order/lineSummary';
import { variationLabel } from '@/components/order/variationLabel';
import CartItemInstructionsEditor from './CartItemInstructionsEditor';

interface CartItemCardProps {
  item: CartItem;
  isSyncing: boolean;
  editingInstructions: string | null;
  setEditingInstructions: (id: string | null) => void;
  instructionsValue: string;
  setInstructionsValue: (value: string) => void;
  onUpdateQuantity: (basketItemId: string | undefined, newQuantity: number) => void;
  onRemoveItem: (basketItemId: string | undefined) => void;
  onSaveInstructions: (basketItemId: string | undefined, quantity: number, instructions: string) => void;
  /**
   * Host template's CSS module (the auth "cart pattern") — classic passes the
   * original CartPage.module.css, craft its order-pad module. Also forwarded to
   * the instructions editor. The line summary is NOT styled from here: since
   * #189 it brings its own module, shared with every other surface.
   */
  styles: Readonly<Record<string, string>>;
}

/**
 * A single cart-item row: image, details (name/variation/price/customizations/instructions/child
 * items), and quantity/remove controls. Extracted verbatim from app/cart/page.tsx (Sprint 4/6
 * god-file decomposition).
 */
export default function CartItemCard({
  item,
  isSyncing,
  editingInstructions,
  setEditingInstructions,
  instructionsValue,
  setInstructionsValue,
  onUpdateQuantity,
  onRemoveItem,
  onSaveInstructions,
  styles,
}: Readonly<CartItemCardProps>) {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language?.split('-')[0] || 'en') as string;
  const itemId = item.basketItemId || item.id || item.productId;
  const variationName = variationLabel(item, currentLanguage);

  return (
    <div className={styles.cartItem}>
      {/* Item Image */}
      {item.productImageUrl && (
        <div className={styles.itemImageContainer}>
          <Image
            src={item.productImageUrl}
            alt={item.productName || 'Product'}
            width={120}
            height={120}
            className={styles.itemImage}
          />
        </div>
      )}

      {/* Item Details */}
      <div className={styles.itemDetails}>
        {/* product-authored text: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
        <h2 dir="auto" className={styles.itemName}>
          {item.productName || 'Unknown Item'}
        </h2>
        {variationName && (
          <p className={styles.itemVariation}>
            <strong>{t('variation', 'Size/Variation')}:</strong> <span dir="auto">{variationName}</span>
          </p>
        )}

        {/* Price Breakdown */}
        <div className={styles.priceBreakdownItem}>
          <p className={styles.itemPrice}>
            {t('base_price', 'Base Price')}: {formatPlainCurrency(item.unitPrice)}
          </p>
          {item.customizationPrice != null && item.customizationPrice !== 0 && (
            <p className={styles.customizationPrice}>
              {t('customization_cost', 'Customizations')}: {item.customizationPrice > 0 ? '+' : ''}
              {formatPlainCurrency(item.customizationPrice)}
            </p>
          )}
        </div>

        {/* The shared read-only summary — ingredient diff, add-on sides, and bundle components with
            their own diffs (#189, finishing menu-bundles slice 2). It replaces both the card's own
            CartItemCustomizations block AND the flat "Includes:" child list that used to sit below
            the instructions editor: that list was a second, thinner renderer of the same data, and
            it could only ever show what someone remembered to add to it — which is how /cart became
            the one cart surface that could not show a bundle component's removals until #363
            patched a row into it by hand.

            `hideInstructions` because CartItemInstructionsEditor below owns the line's own notes
            for display AND edit; without it the card would print them twice. A component's notes
            are not covered by that editor and still render here.

            `showChildPrices` preserves the "+2.99" upcharge the old Includes list showed — it is
            opt-in precisely so this migration changes no other surface. */}
        <OrderLineSummary line={basketItemToLineSummary(item)} hideInstructions showChildPrices />

        <CartItemInstructionsEditor
          styles={styles}
          item={item}
          itemId={itemId}
          isSyncing={isSyncing}
          editingInstructions={editingInstructions}
          setEditingInstructions={setEditingInstructions}
          instructionsValue={instructionsValue}
          setInstructionsValue={setInstructionsValue}
          onSaveInstructions={onSaveInstructions}
        />
      </div>

      {/* Item Controls */}
      <div className={styles.itemControls}>
        <div className={styles.quantityControl}>
          <button
            type="button"
            onClick={() => onUpdateQuantity(itemId, item.quantity - 1)}
            className={styles.quantityButton}
            disabled={isSyncing || item.quantity <= 1}
            aria-label={t('decrease_quantity', 'Decrease quantity')}
          >
            <Minus size={16} />
          </button>
          <span className={styles.itemQuantity}>{item.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(itemId, item.quantity + 1)}
            className={styles.quantityButton}
            disabled={isSyncing}
            aria-label={t('increase_quantity', 'Increase quantity')}
          >
            <Plus size={16} />
          </button>
        </div>

        <p className={styles.itemSubtotal}>{formatPlainCurrency(item.itemTotal)}</p>

        {/* Remove Button */}
        <button
          type="button"
          onClick={() => onRemoveItem(itemId)}
          className={styles.removeItemButton}
          disabled={isSyncing}
          aria-label={t('remove_item', 'Remove item')}
        >
          <Trash2 size={16} />
          <span>{t('remove', 'Remove')}</span>
        </button>
      </div>
    </div>
  );
}
