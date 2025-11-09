'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../app/styles/CashierPage.module.css';
import { OrderDto } from '@/types/order';
import { OrderType } from '@/types/order';

interface OrderListProps {
  orders: OrderDto[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  isLoading: boolean;
  error: string | null;
}

export default function OrderList({
  orders,
  selectedOrderId,
  onSelectOrder,
  isLoading,
  error,
}: OrderListProps) {
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
    return (
      <div className={styles.orderListEmpty}>
        {t('cashier.no_orders', 'No orders found')}
      </div>
    );
  }

  return (
    <div className={styles.orderList}>
      {orders.map((order) => (
        <div
          key={order.id}
          className={`${styles.orderItem} ${
            selectedOrderId === order.id ? styles.selected : ''
          }`}
          onClick={() => onSelectOrder(order.id)}
        >
          <div className={styles.orderItemHeader}>
            <span className={styles.orderNumber}>{order.orderNumber}</span>
            <span className={styles.orderStatusBadge}>
              {t(`order_status.${order.status.toLowerCase()}`, order.status)}
            </span>
          </div>
          <div className={styles.orderCustomer}>
            {order.customerName || t('guest.label', 'Guest')}
            {order.type === OrderType.DineIn && order.tableNumber && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                • Table {order.tableNumber}
              </span>
            )}
          </div>
          <div className={styles.orderFooter}>
            <span className={styles.orderTotal}>
              CHF {order.total?.toFixed(2) || '0.00'}
            </span>
            <span className={styles.orderTime}>
              {new Date(order.orderDate).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
