'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ShoppingBag, Truck, Pencil } from 'lucide-react';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useCart } from '@/components/cart/CartContext';
import styles from './OrderTypeStickyHeader.module.css';

interface OrderTypeStickyHeaderProps {
  /**
   * Fired when the user wants to change their pick — typically wired up to
   * `useOrderTypeWelcomePrompt().openWelcomeModal`. The host owns the modal.
   */
  onChange: () => void;
}

const ICON_BY_TYPE: Record<OrderType, React.ReactNode> = {
  [OrderType.DineIn]: <Utensils size={18} />,
  [OrderType.Takeaway]: <ShoppingBag size={18} />,
  [OrderType.Delivery]: <Truck size={18} />,
};

/**
 * Renders below the menu page header when an order type has been chosen.
 * Shows the current type + relevant detail (table number for dine-in,
 * delivery city, otherwise nothing) and a "Change" button.
 *
 * When the cart isn't empty, the change action confirms via window.confirm
 * before re-opening the welcome modal — items added under one type may not
 * be valid under another (e.g. delivery-excluded items if switching to
 * Delivery). C1.5.b will replace the native confirm with a proper modal
 * (TableSelectionModal flow surfaces the same UX gap).
 *
 * Returns null when no order type is set — the welcome modal handles that
 * case via `useOrderTypeWelcomePrompt`.
 */
export default function OrderTypeStickyHeader({ onChange }: OrderTypeStickyHeaderProps) {
  const { t } = useTranslation();
  const { state } = useOrderType();
  const { state: cartState } = useCart();

  if (!state.orderType) return null;

  const cartHasItems = cartState.items.length > 0;

  const handleChange = () => {
    if (cartHasItems) {
      // TODO(C1.5.b): replace with a BaseModal-backed confirm dialog.
      const ok = window.confirm(
        t('order_type_change_confirm', 'Changing your order type may affect items in your cart. Continue?'),
      );
      if (!ok) return;
    }
    onChange();
  };

  // role="region" + aria-label scopes the live region to just the type +
  // detail spans (the chrome-y label and Change button shouldn't re-announce
  // every time state changes). aria-live="polite" sits on the inner span pair.
  const detail = detailFor(state, t);
  return (
    <div role="region" aria-label={t('order_type', 'Order type')} className={styles.bar}>
      <span className={styles.iconWrapper}>{ICON_BY_TYPE[state.orderType]}</span>
      <span className={styles.label}>{t('order_type', 'Order type')}:</span>
      <span aria-live="polite" className={styles.liveRegion}>
        <span className={styles.value}>{labelFor(state.orderType, t)}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      <button type="button" onClick={handleChange} className={styles.changeButton}>
        <Pencil size={14} />
        {t('order_type_change', 'Change')}
      </button>
    </div>
  );
}

function labelFor(type: OrderType, t: (k: string, fallback: string) => string): string {
  switch (type) {
    case OrderType.DineIn:
      return t('order_type_dine_in', 'Dine In');
    case OrderType.Takeaway:
      return t('order_type_takeaway', 'Takeaway');
    case OrderType.Delivery:
      return t('order_type_delivery', 'Delivery');
  }
}

function detailFor(
  state: ReturnType<typeof useOrderType>['state'],
  t: (k: string, fallback: string) => string,
): string | null {
  if (state.orderType === OrderType.DineIn && state.table) {
    return t('table', 'Table') + ' ' + state.table;
  }
  if (state.orderType === OrderType.Delivery && state.deliveryAddress?.city) {
    return state.deliveryAddress.city;
  }
  return null;
}
