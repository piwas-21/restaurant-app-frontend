'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus, ShoppingCart, ChevronRight } from 'lucide-react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import type { OrderType } from '@/types/order';
import OrderTypeToggle from './OrderTypeToggle';
import styles from './CartContents.module.css';

interface CartContentsProps {
  /** Toggle click handler — comes from `useOrderTypeFollowUp.pickType`.
   * Accepts an optional `source` we forward via the wrapper below so the
   * `order_type_selected` event carries the correct surface tag. */
  pickType: (type: OrderType, source?: string) => void;
  /** Optional callback fired right after Proceed-to-Checkout — lets a parent
   * sheet close itself before the route transition completes (mobile sheet). */
  onProceed?: () => void;
  /** Analytics-surface tag forwarded to `checkout_opened` so the funnel can
   * distinguish desktop sidebar vs. mobile bottom-sheet vs. legacy /cart.
   * Defaults to 'sidebar' — see useSmartCheckoutRouter for the funnel
   * contract. */
  analyticsSource?: string;
}

/**
 * Cart-half rendering shared by the desktop sidebar (`OrderFlowSidebar`)
 * and the mobile bottom-sheet (`MobileCartSheet`). Owns no chrome — the
 * caller wraps it in `<aside>` (sidebar) or `BaseModal` (sheet) and
 * provides any title.
 */
export default function CartContents({ pickType, onProceed, analyticsSource = 'sidebar' }: CartContentsProps) {
  const { t } = useTranslation();
  const { state: cartState, updateItem, removeItem } = useCart();
  const { state: orderTypeState, hasChosenOrderType } = useOrderType();
  const { proceedToCheckout, isResolving } = useSmartCheckoutRouter();

  const itemCount = cartState.items.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = cartState.items.reduce((acc, it) => acc + it.itemTotal, 0);
  const canCheckout = itemCount > 0 && hasChosenOrderType;

  const handleQty = (basketItemId: string | undefined, next: number) => {
    if (!basketItemId || next < 1) return;
    updateItem(basketItemId, next).catch(() => {
      /* CartContext surfaces the error */
    });
  };

  const handleRemove = (basketItemId: string | undefined) => {
    if (!basketItemId) return;
    removeItem(basketItemId).catch(() => {
      /* CartContext surfaces the error */
    });
  };

  const handleCheckout = () => {
    if (!canCheckout || !orderTypeState.orderType) return;
    onProceed?.();
    // proceedToCheckout has its own try/catch (toasts on failure); fire-and-forget.
    void proceedToCheckout(orderTypeState.orderType, analyticsSource);
  };

  // Wrap pickType so the analytics surface tag flows into
  // `order_type_selected` (otherwise the event always reads as 'sidebar'
  // even when the user clicked inside the mobile bottom-sheet).
  const handlePick = (type: OrderType) => pickType(type, analyticsSource);

  return (
    <>
      <OrderTypeToggle onPick={handlePick} />

      {cartState.items.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingCart size={36} aria-hidden="true" />
          <p>{t('cart_empty_message', 'Your cart is empty')}</p>
        </div>
      ) : (
        <ul className={styles.itemList}>
          {cartState.items.map((item) => {
            const itemId = item.basketItemId || item.id || item.productId;
            return (
              <li key={itemId} className={styles.item}>
                <div className={styles.itemRow}>
                  <span className={styles.itemName}>{item.productName}</span>
                  <span className={styles.itemPrice}>CHF {item.itemTotal.toFixed(2)}</span>
                </div>
                <div className={styles.itemControls}>
                  <button
                    type="button"
                    onClick={() => handleRemove(itemId)}
                    className={styles.iconButton}
                    aria-label={t('remove_item', 'Remove item')}
                    disabled={cartState.isSyncing}
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className={styles.qtyGroup}>
                    <button
                      type="button"
                      onClick={() => handleQty(itemId, item.quantity - 1)}
                      className={styles.qtyButton}
                      aria-label={t('decrease_quantity', 'Decrease quantity')}
                      disabled={cartState.isSyncing || item.quantity <= 1}
                    >
                      <Minus size={14} />
                    </button>
                    <span className={styles.qty}>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleQty(itemId, item.quantity + 1)}
                      className={styles.qtyButton}
                      aria-label={t('increase_quantity', 'Increase quantity')}
                      disabled={cartState.isSyncing}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.totalRow}>
        <span>{t('cart_total_label', 'Total')}</span>
        <span className={styles.totalValue}>CHF {subtotal.toFixed(2)}</span>
      </div>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={!canCheckout || isResolving}
        className={styles.checkoutButton}
        aria-label={t('proceed_to_checkout', 'Proceed to Checkout')}
      >
        {t('proceed_to_checkout', 'Proceed to Checkout')}
        <ChevronRight size={18} />
      </button>
    </>
  );
}
