'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ShoppingBag, Truck } from 'lucide-react';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import styles from './OrderTypeToggle.module.css';

interface OrderTypeToggleProps {
  /**
   * Fired when the user clicks a type. Host typically wires this up to
   * `useOrderTypeFollowUp().pickType` so DineIn/Delivery clicks open the
   * relevant detail modal.
   */
  onPick: (type: OrderType) => void;
}

const ICON_BY_TYPE: Record<OrderType, React.ReactNode> = {
  [OrderType.DineIn]: <Utensils size={18} />,
  [OrderType.Takeaway]: <ShoppingBag size={18} />,
  [OrderType.Delivery]: <Truck size={18} />,
};

/**
 * Order-type segmented toggle for the desktop cart sidebar.
 * The set of buttons is **dynamic** — driven by
 * `useEnabledOrderTypes()` which reads the admin-enabled list from the
 * orderTypeConfigurationService. Disabling Delivery in admin therefore
 * hides the Delivery button automatically; no client-side feature flag.
 *
 * The active button reflects `useOrderType().state.orderType` so the
 * toggle stays in sync with the source of truth (e.g. when QR-scan
 * auto-pins DineIn, the toggle highlights DineIn without an explicit
 * click).
 */
function OrderTypeToggleImpl({ onPick }: OrderTypeToggleProps) {
  const { t } = useTranslation();
  const { state } = useOrderType();
  const { enabled, loading } = useEnabledOrderTypes();

  if (loading || enabled.length === 0) {
    // While the admin-enabled list is in flight, render a spacer-shaped
    // skeleton row so the sidebar doesn't visibly jump when the buttons
    // arrive. Empty fallback is also OK if every type is disabled.
    return <div className={styles.skeleton} aria-hidden="true" />;
  }

  return (
    <div role="group" aria-label={t('order_type', 'Order type')} className={styles.group}>
      {enabled.map((type) => {
        const isActive = state.orderType === type;
        return (
          <button
            key={type}
            type="button"
            className={`${styles.button} ${isActive ? styles.active : ''}`}
            onClick={() => onPick(type)}
            aria-pressed={isActive}
          >
            <span className={styles.icon}>{ICON_BY_TYPE[type]}</span>
            <span className={styles.label}>{labelFor(type, t)}</span>
          </button>
        );
      })}
    </div>
  );
}

// Memoized so the `useCallback`-stabilised `onPick` from CartContents (PR
// #74 review) actually prevents this child from re-rendering on parent
// re-renders. Props are a single function reference; context-driven state
// (orderType, enabled list) already invalidates only on real changes.
const OrderTypeToggle = React.memo(OrderTypeToggleImpl);
export default OrderTypeToggle;

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
