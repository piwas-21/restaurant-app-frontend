import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
// One source for the status modifier class. The ladder this replaces handled six of the ten
// statuses and returned '' for the rest — an unstyled badge, which reads as "no status" rather
// than as an unhandled one.
import { nextOrderStatuses, orderStatusLabel, orderStatusMeta } from '@/lib/orderStatus';
import { OrderDto, OrderStatus, OrderType } from '@/types/order';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import styles from './OrderCard.module.css';

interface OrderCardProps {
  order: OrderDto;
  onStatusChange: (orderId: string, status: string) => void;
  isLoading?: boolean;
}

// The primary next action, derived from the SHARED transition table (#547) instead of the local
// case ladder this card used to own. The table allows `Ready → OutForDelivery`, which the ladder
// could not express, so a delivery order could not be dispatched from the surface that sees it.
// Two exclusions stay deliberate: `Cancelled` is never the card's primary offer, and
// `OutForDelivery` is offered only to delivery orders — every other card still moves exactly as
// it did before (Pending→Confirmed→Preparing→Ready→Completed).
function primaryNextStatus(order: OrderDto): OrderStatus | null {
  const isDelivery = order.type === OrderType.Delivery;
  return (
    nextOrderStatuses(order.status).find(
      (status) => status !== 'Cancelled' && (status !== 'OutForDelivery' || isDelivery),
    ) ?? null
  );
}

// Button copy per target status — the same keys and English fallbacks the in-component switch
// used, plus the dispatch path. `PendingApproval` never wins the primary slot (`Confirmed`
// precedes it in the table), so it needs no entry.
const NEXT_ACTION: Partial<Record<OrderStatus, { key: string; fallback: string }>> = {
  Confirmed: { key: 'server.confirm_order', fallback: 'Confirm Order' },
  Preparing: { key: 'server.start_preparing', fallback: 'Start Preparing' },
  Ready: { key: 'server.mark_ready', fallback: 'Mark Ready' },
  OutForDelivery: { key: 'server.dispatch_order', fallback: 'Out for Delivery' },
  Completed: { key: 'server.complete_order', fallback: 'Complete Order' },
};

export default function OrderCard({ order, onStatusChange, isLoading }: OrderCardProps) {
  const { t, i18n } = useTranslation();

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    // `[]` is not "no preference", it is the BROWSER's locale — the same defect as the header's
    // clock one component over, on the same screen (#610).
    return date.toLocaleTimeString(i18n.language || 'en', { hour: '2-digit', minute: '2-digit' });
  };

  const nextStatus = primaryNextStatus(order);
  const nextAction = nextStatus ? NEXT_ACTION[nextStatus] : undefined;

  return (
    <div className={`${styles.card} ${styles[orderStatusMeta(order.status)?.className ?? ''] ?? ''}`}>
      <div className={styles.header}>
        <div className={styles.orderInfo}>
          <span className={styles.orderNumber}>#{order.orderNumber}</span>
          <span className={styles.tableNumber}>
            {t('server.table', 'Table')} {order.tableNumber}
          </span>
        </div>
        <div className={styles.statusBadge}>{orderStatusLabel(order.status, t)}</div>
      </div>

      <div className={styles.meta}>
        <span className={styles.time}>🕐 {formatTime(order.orderDate)}</span>
        {order.customerName && <span className={styles.customer}>👤 {order.customerName}</span>}
      </div>

      <div className={styles.items}>
        {order.items.map((item, index) => (
          <React.Fragment key={item.id || index}>
            <div className={styles.item}>
              <span className={styles.itemQuantity}>{item.quantity}×</span>
              <span className={styles.itemName}>{item.productName || 'Unknown Item'}</span>
              {item.variationName && <span className={styles.itemVariation}>({item.variationName})</span>}
            </div>
            <OrderLineSummary line={orderItemToLineSummary(item)} />
          </React.Fragment>
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
          <span className={styles.totalAmount}>{formatPlainCurrency(order.total)}</span>
        </div>

        {nextStatus && nextAction && (
          <button
            className={styles.actionButton}
            onClick={() => onStatusChange(order.id, nextStatus)}
            disabled={isLoading}
          >
            {isLoading ? t('server.updating', 'Updating...') : t(nextAction.key, nextAction.fallback)}
          </button>
        )}
      </div>
    </div>
  );
}
