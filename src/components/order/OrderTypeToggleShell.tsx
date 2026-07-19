'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ShoppingBag, Truck } from 'lucide-react';
import { OrderType } from '@/types/order';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

const ICON_BY_TYPE: Record<OrderType, React.ReactNode> = {
  [OrderType.DineIn]: <Utensils size={18} />,
  [OrderType.Takeaway]: <ShoppingBag size={18} />,
  [OrderType.Delivery]: <Truck size={18} />,
};

interface OrderTypeToggleShellProps {
  /**
   * Fired when the user clicks a type. Host typically wires this to
   * `useOrderTypeFollowUp().pickType` so DineIn/Delivery clicks open the
   * relevant detail modal.
   */
  onPick: (type: OrderType) => void;
  /**
   * Host template's CSS module — must define `group`, `button`, `active`,
   * `icon`, `label`, `skeleton`. The classic sidebar toggle and craft's
   * order-pad chips pass their own module, so the two share this markup /
   * behaviour (Sonar new-code dedup) and differ only in CSS.
   */
  styles: Readonly<Record<string, string>>;
}

/**
 * Order-type segmented picker shared by `OrderTypeToggle` (classic) and
 * `CraftOrderTypeToggle`. The set of buttons is **dynamic** — driven by
 * `useEnabledOrderTypes()` (admin-enabled list), so disabling Delivery in admin
 * hides its button with no client flag. The active button reflects
 * `useOrderType().state.orderType` so the toggle stays in sync with the source
 * of truth (e.g. QR-scan auto-pinning DineIn highlights it without a click).
 *
 * Not memoized here — each template wraps this in its own `React.memo` (props
 * are a single `onPick` function ref).
 */
export default function OrderTypeToggleShell({ onPick, styles }: Readonly<OrderTypeToggleShellProps>) {
  const { t } = useTranslation();
  const { state } = useOrderType();
  const { enabled, loading } = useEnabledOrderTypes();

  if (loading || enabled.length === 0) {
    // While the admin-enabled list is in flight, render a spacer-shaped skeleton
    // so the panel doesn't visibly jump when the buttons arrive. Empty fallback
    // is also OK if every type is disabled.
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
