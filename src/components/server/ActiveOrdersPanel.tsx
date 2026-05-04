import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import OrderCard from './OrderCard';
import styles from './ActiveOrdersPanel.module.css';

interface ActiveOrdersPanelProps {
  orders: OrderDto[];
  selectedTableNumber: string | null;
  onStatusChange: (orderId: string, status: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export default function ActiveOrdersPanel({
  orders,
  selectedTableNumber,
  onStatusChange,
  isLoading,
  error,
}: ActiveOrdersPanelProps) {
  const { t } = useTranslation();

  // Filter active orders (exclude completed/cancelled)
  const activeOrders = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status));

  // Filter by selected table if any
  const displayedOrders = selectedTableNumber
    ? activeOrders.filter((order) => order.tableNumber?.toString() === selectedTableNumber)
    : activeOrders;

  // Sort by order date (newest first)
  const sortedOrders = [...displayedOrders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {selectedTableNumber
            ? `${t('server.table', 'Table')} ${selectedTableNumber} ${t('server.orders', 'Orders')}`
            : t('server.all_active_orders', 'All Active Orders')}
        </h2>
        <span className={styles.badge}>{sortedOrders.length}</span>
      </div>

      {error && (
        <div className={styles.error}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className={styles.orderList}>
        {isLoading && sortedOrders.length === 0 ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <span>{t('server.loading_orders', 'Loading orders...')}</span>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📋</span>
            <span className={styles.emptyText}>
              {selectedTableNumber
                ? t('server.no_orders_table', 'No active orders for this table')
                : t('server.no_active_orders', 'No active dine-in orders')}
            </span>
          </div>
        ) : (
          sortedOrders.map((order) => (
            <OrderCard key={order.id} order={order} onStatusChange={onStatusChange} isLoading={isLoading} />
          ))
        )}
      </div>
    </div>
  );
}
