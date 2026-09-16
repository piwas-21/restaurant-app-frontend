import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import OrderCard from './OrderCard';
import styles from './ActiveOrdersPanel.module.css';

interface ActiveOrdersPanelProps {
  orders: OrderDto[];
  selectedTableNumber: string | null;
  onStatusChange: (orderId: string, status: string) => void;
  statusFilter?: string;
  isLoading?: boolean;
  error?: string | null;
}

export default function ActiveOrdersPanel({
  orders,
  selectedTableNumber,
  onStatusChange,
  statusFilter = 'active',
  isLoading,
  error,
}: ActiveOrdersPanelProps) {
  const { t } = useTranslation();

  // Filtering belongs to the page-level status selector. Applying an active-only filter here as
  // well made the explicit "All" view silently drop Completed and Cancelled orders.
  const displayedOrders = selectedTableNumber
    ? orders.filter((order) => order.tableNumber?.toString() === selectedTableNumber)
    : orders;

  // Sort by order date (newest first)
  const sortedOrders = [...displayedOrders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
  );

  let panelTitle = t('server.all_active_orders', 'All Active Orders');
  if (statusFilter === 'all') panelTitle = t('server.filter_all', 'All Orders');
  if (selectedTableNumber) {
    panelTitle = `${t('server.table', 'Table')} ${selectedTableNumber} ${t('server.orders', 'Orders')}`;
  }

  let emptyMessage = t('server.no_active_orders', 'No active dine-in orders');
  if (statusFilter === 'all') emptyMessage = t('server.no_orders', 'No dine-in orders');
  if (selectedTableNumber) emptyMessage = t('server.no_orders_table', 'No active orders for this table');

  const renderOrderList = () => {
    if (isLoading && sortedOrders.length === 0) {
      return (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>{t('server.loading_orders', 'Loading orders...')}</span>
        </div>
      );
    }

    if (sortedOrders.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📋</span>
          <span className={styles.emptyText}>{emptyMessage}</span>
        </div>
      );
    }

    return sortedOrders.map((order) => (
      <OrderCard key={order.id} order={order} onStatusChange={onStatusChange} isLoading={isLoading} />
    ));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{panelTitle}</h2>
        <span className={styles.badge}>{sortedOrders.length}</span>
      </div>

      {error && (
        <div className={styles.error}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className={styles.orderList}>{renderOrderList()}</div>
    </div>
  );
}
