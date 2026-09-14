'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../app/styles/CashierPage.module.css';
import { OrderDto, OrderType } from '@/types/order';
import { type OrderStatusBadgeFill } from '@/lib/orderStatus';
import { orderStatusPresentation } from '@/lib/orderStatusPresentation';
import StatusBadge from '@/components/design-system/StatusBadge';

interface OrderListProps {
  readonly orders: readonly OrderDto[];
  readonly selectedOrderId: string | null;
  readonly onSelectOrder: (orderId: string) => void;
  readonly isLoading: boolean;
  readonly error: string | null;
}

// Helper to get time ago string
const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

// Helper to get order type display
const getOrderTypeDisplay = (type: string) => {
  switch (type) {
    case OrderType.DineIn:
      return { icon: '🍽️', label: 'Dine In', color: '#3b82f6' };
    case OrderType.Takeaway:
      return { icon: '🛍️', label: 'Takeaway', color: '#f97316' };
    case OrderType.Delivery:
      return { icon: '🚚', label: 'Delivery', color: '#8b5cf6' };
    default:
      return { icon: '📦', label: type, color: '#6b7280' };
  }
};

// This module's binding of the SHARED status→badge-fill key (#336). The switch that used to
// live here — duplicated verbatim in OrderDetails, which is how a contrast fix once landed on
// one pill and not its twin — is gone; `orderStatusBadgeFill` makes the decision, and this
// Record only binds each fill key to this module's tokenised, contrast-checked class.
const BADGE_FILL_CLASS: Record<OrderStatusBadgeFill, string> = {
  pending: styles.orderStatusBadgePending,
  confirmed: styles.orderStatusBadgeConfirmed,
  preparing: styles.orderStatusBadgePreparing,
  ready: styles.orderStatusBadgeReady,
  cancelled: styles.orderStatusBadgeCancelled,
  completed: styles.orderStatusBadgeCompleted,
};

export default function OrderList({ orders, selectedOrderId, onSelectOrder, isLoading, error }: OrderListProps) {
  const { t } = useTranslation();

  if (error && orders.length === 0) {
    return (
      <div className={styles.errorState}>
        <p className={styles.errorMessage}>{t('cashier.error_loading_orders', 'Error loading orders')}</p>
      </div>
    );
  }

  if (isLoading && orders.length === 0) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}>⟳</div>
        <p>{t('cashier.loading', 'Loading orders...')}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return <div className={styles.orderListEmpty}>{t('cashier.no_orders', 'No orders found')}</div>;
  }

  return (
    <div>
      {orders.map((order) => {
        const orderTypeDisplay = getOrderTypeDisplay(order.type);
        const status = orderStatusPresentation(order.status, t);
        const statusBadgeModifier = BADGE_FILL_CLASS[status.fill];
        const isSelected = selectedOrderId === order.id;

        return (
          <div
            key={order.id}
            className={`${styles.orderCard} ${isSelected ? styles.orderCardSelected : ''}`}
            onClick={() => onSelectOrder(order.id)}
            style={{
              // Logical, to stay on the same edge as `.orderCard`'s `border-inline-start-width`
              // (E8). Width and colour are one feature — the order-type accent stripe — and if
              // only the width mirrors, `ar` gets a grey 4px bar on one side and a coloured 1px
              // bar on the other, which is the colour coding gone.
              borderInlineStartColor: orderTypeDisplay.color,
            }}
          >
            <div className={styles.orderCardHeader}>
              <div className={styles.orderCardTitle}>
                <span className={styles.orderTypeIcon}>{orderTypeDisplay.icon}</span>
                <span className={styles.orderNumber}>{order.orderNumber}</span>
              </div>
              <StatusBadge tone={status.tone} className={`${styles.orderStatusBadge} ${statusBadgeModifier}`}>
                {status.label}
              </StatusBadge>
            </div>

            <div className={styles.orderCardBody}>
              <div className={styles.orderCustomer}>
                <span className={styles.customerName}>{order.customerName || t('guest', 'Guest')}</span>
                {order.type === OrderType.DineIn && order.tableNumber && (
                  <span className={styles.tableNumber}>Table {order.tableNumber}</span>
                )}
              </div>

              <div className={styles.orderCardFooter}>
                <span className={styles.orderTotal}>{formatPlainCurrency(order.total ?? 0)}</span>
                <span className={styles.orderTime}>{getTimeAgo(order.orderDate)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
