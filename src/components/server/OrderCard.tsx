import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import styles from './OrderCard.module.css';

interface OrderCardProps {
  order: OrderDto;
  onStatusChange: (orderId: string, status: string) => void;
  isLoading?: boolean;
}

export default function OrderCard({ order, onStatusChange, isLoading }: OrderCardProps) {
  const { t } = useTranslation();

  const getStatusClass = () => {
    switch (order.status) {
      case 'Pending':
        return styles.statusPending;
      case 'Confirmed':
        return styles.statusConfirmed;
      case 'Preparing':
        return styles.statusPreparing;
      case 'Ready':
        return styles.statusReady;
      case 'Completed':
        return styles.statusCompleted;
      case 'Cancelled':
        return styles.statusCancelled;
      default:
        return '';
    }
  };

  const getNextStatus = () => {
    switch (order.status) {
      case 'Pending':
        return 'Confirmed';
      case 'Confirmed':
        return 'Preparing';
      case 'Preparing':
        return 'Ready';
      case 'Ready':
        return 'Completed';
      default:
        return null;
    }
  };

  const getNextStatusLabel = () => {
    const next = getNextStatus();
    switch (next) {
      case 'Confirmed':
        return t('server.confirm_order', 'Confirm Order');
      case 'Preparing':
        return t('server.start_preparing', 'Start Preparing');
      case 'Ready':
        return t('server.mark_ready', 'Mark Ready');
      case 'Completed':
        return t('server.complete_order', 'Complete Order');
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const nextStatus = getNextStatus();
  const nextStatusLabel = getNextStatusLabel();

  return (
    <div className={`${styles.card} ${getStatusClass()}`}>
      <div className={styles.header}>
        <div className={styles.orderInfo}>
          <span className={styles.orderNumber}>#{order.orderNumber}</span>
          <span className={styles.tableNumber}>
            {t('server.table', 'Table')} {order.tableNumber}
          </span>
        </div>
        <div className={styles.statusBadge}>{t(`order.status_${order.status.toLowerCase()}`, order.status)}</div>
      </div>

      <div className={styles.meta}>
        <span className={styles.time}>🕐 {formatTime(order.orderDate)}</span>
        {order.customerName && <span className={styles.customer}>👤 {order.customerName}</span>}
      </div>

      <div className={styles.items}>
        {order.items.map((item, index) => (
          <div key={item.id || index} className={styles.item}>
            <span className={styles.itemQuantity}>{item.quantity}×</span>
            <span className={styles.itemName}>{item.productName || 'Unknown Item'}</span>
            {item.variationName && <span className={styles.itemVariation}>({item.variationName})</span>}
          </div>
        ))}
      </div>

      {order.notes && (
        <div className={styles.notes}>
          <span className={styles.notesIcon}>📝</span>
          <span className={styles.notesText}>{order.notes}</span>
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.total}>
          <span className={styles.totalLabel}>{t('server.total', 'Total')}</span>
          <span className={styles.totalAmount}>CHF {order.total.toFixed(2)}</span>
        </div>

        {nextStatus && nextStatusLabel && (
          <button
            className={styles.actionButton}
            onClick={() => onStatusChange(order.id, nextStatus)}
            disabled={isLoading}
          >
            {isLoading ? t('server.updating', 'Updating...') : nextStatusLabel}
          </button>
        )}
      </div>
    </div>
  );
}
