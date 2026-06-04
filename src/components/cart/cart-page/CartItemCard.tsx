'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/components/cart/cartTypes';
import styles from '@/app/styles/CartPage.module.css';
import CartItemCustomizations from './CartItemCustomizations';
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
}: CartItemCardProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language?.split('-')[0] || 'en') as string;
  const itemId = item.basketItemId || item.id || item.productId;
  const variationName =
    item.variationContent?.[currentLanguage]?.name || item.variationContent?.en?.name || item.variationName;

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
        <h2 className={styles.itemName}>{item.productName || 'Unknown Item'}</h2>
        {variationName && (
          <p className={styles.itemVariation}>
            <strong>{t('variation', 'Size/Variation')}:</strong> {variationName}
          </p>
        )}

        {/* Price Breakdown */}
        <div className={styles.priceBreakdownItem}>
          <p className={styles.itemPrice}>
            {t('base_price', 'Base Price')}: CHF {item.unitPrice.toFixed(2)}
          </p>
          {item.customizationPrice != null && item.customizationPrice !== 0 && (
            <p className={styles.customizationPrice}>
              {t('customization_cost', 'Customizations')}: {item.customizationPrice > 0 ? '+' : ''}CHF{' '}
              {item.customizationPrice.toFixed(2)}
            </p>
          )}
        </div>

        <CartItemCustomizations item={item} />

        <CartItemInstructionsEditor
          item={item}
          itemId={itemId}
          isSyncing={isSyncing}
          editingInstructions={editingInstructions}
          setEditingInstructions={setEditingInstructions}
          instructionsValue={instructionsValue}
          setInstructionsValue={setInstructionsValue}
          onSaveInstructions={onSaveInstructions}
        />

        {/* Child Items for Menu Bundles */}
        {item.childItems && item.childItems.length > 0 && (
          <div className={styles.childItemsContainer}>
            <h4 className={styles.childItemsTitle}>{t('includes', 'Includes')}:</h4>
            <ul className={styles.childItemsList}>
              {item.childItems.map((childItem, idx) => (
                <li key={idx} className={styles.childItem}>
                  <span className={styles.childItemName}>{childItem.productName}</span>
                  {childItem.unitPrice > 0 && (
                    <span className={styles.childItemPrice}>+CHF {childItem.unitPrice.toFixed(2)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
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

        <p className={styles.itemSubtotal}>CHF {item.itemTotal.toFixed(2)}</p>

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
