'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus, ShoppingCart, ChevronRight } from 'lucide-react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import type { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import OrderTypeToggle from './OrderTypeToggle';
import styles from './OrderFlowSidebar.module.css';

interface OrderFlowSidebarProps {
  /** Wired so the toggle's clicks can trigger the table/address modals. */
  followUp: ReturnType<typeof useOrderTypeFollowUp>;
}

/**
 * Desktop right-rail (BUGS-IMPROVEMENTS-PLAN §C1.5.c). Replaces the
 * earlier welcome-modal-on-page-load pattern: the user browses freely,
 * adds items, then picks/changes order type via the toggle in this
 * sidebar whenever they're ready.
 *
 * Hidden on small screens (mobile keeps the existing FloatingCartButton
 * + /cart navigation; full mobile bottom-sheet is C1.5.c follow-up).
 *
 * Owns no transient state of its own — everything reads from
 * `useCart` + `useOrderType`. The toggle delegates picking back to
 * `useOrderTypeFollowUp.pickType` so DineIn/Delivery clicks open the
 * relevant detail modal via OrderFlowModals.
 */
export default function OrderFlowSidebar({ followUp }: OrderFlowSidebarProps) {
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
      /* CartContext surfaces the error; sidebar stays passive */
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
    proceedToCheckout(orderTypeState.orderType);
  };

  return (
    <aside className={styles.sidebar} aria-label={t('shopping_basket', 'Shopping Basket')}>
      <h2 className={styles.title}>{t('shopping_basket', 'Shopping Basket')}</h2>

      <OrderTypeToggle onPick={followUp.pickType} />

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
    </aside>
  );
}
