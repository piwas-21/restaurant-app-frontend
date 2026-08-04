'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../app/styles/CashierPage.module.css';
import { OrderDto, OrderStatus } from '@/types/order';
import { OrderType } from '@/types/order';
import { getOrderStatusTranslationKey } from '@/utils/orderStatusStyles';

interface OrderListProps {
  orders: OrderDto[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  isLoading: boolean;
  error: string | null;
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

// Helper to get the status badge's fill modifier class. Returns a class rather than
// a colour so the fill stays in the stylesheet, tokenised and contrast-checked
// (see .orderStatusBadge in CashierPage.module.css) instead of inline on the span.
const getStatusBadgeModifier = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return styles.orderStatusBadgePending;
    case 'confirmed':
      return styles.orderStatusBadgeConfirmed;
    case 'preparing':
      return styles.orderStatusBadgePreparing;
    case 'ready':
      return styles.orderStatusBadgeReady;
    case 'cancelled':
      return styles.orderStatusBadgeCancelled;
    // An unrecognised status falls back to the Completed fill — the same grey the
    // old hex map used as its default. The class name overstates it: the order is
    // not necessarily completed, the grey is just the neutral fill.
    case 'completed':
    default:
      return styles.orderStatusBadgeCompleted;
  }
};

export default function OrderList({ orders, selectedOrderId, onSelectOrder, isLoading, error }: OrderListProps) {
  const { t } = useTranslation();

  if (error) {
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
    <div className={styles.orderList}>
      {orders.map((order) => {
        const orderTypeDisplay = getOrderTypeDisplay(order.type);
        const statusBadgeModifier = getStatusBadgeModifier(order.status);
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
              <span className={`${styles.orderStatusBadge} ${statusBadgeModifier}`}>
                {t(getOrderStatusTranslationKey(order.status as OrderStatus), order.status)}
              </span>
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
