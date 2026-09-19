'use client';

import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import type { OrderDto } from '@/types/order';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import styles from './CashierWorkspaceList.module.css';

interface CashierReadOnlyOrderListProps {
  readonly orders: readonly OrderDto[];
  readonly selectedOrderId: string | null;
  readonly timeZone?: string;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onOrderRowRef?: (orderId: string, node: HTMLButtonElement | null) => void;
}

function orderTypeLabel(type: string, t: TFunction): string {
  if (type === 'DineIn') return t('cashier.workspace.channel_dine_in');
  if (type === 'Takeaway') return t('cashier.workspace.channel_takeaway');
  if (type === 'Delivery') return t('cashier.workspace.channel_delivery');
  return type;
}

function orderTime(orderDate: string, language: string, timeZone: string | undefined, t: TFunction): string {
  return formatCashierDateTime(orderDate, language, timeZone, 'short', t('cashier.workspace.unknown_time'));
}

function amountDue(order: OrderDto): number {
  if (typeof order.remainingAmount === 'number') return order.remainingAmount;
  return order.total - order.totalPaid;
}

function amountPresentation(
  due: number,
  order: OrderDto,
  t: (key: string, options?: Record<string, unknown>) => string,
): { className: string; label: string } {
  if (due > 0) {
    return {
      className: styles.amountDue,
      label: t('cashier.workspace.due_value', { amount: formatOrderCurrency(due, order) }),
    };
  }
  if (due < 0) {
    return {
      className: styles.amountCredit,
      label: t('cashier.workspace.credit_value', { amount: formatOrderCurrency(Math.abs(due), order) }),
    };
  }
  return { className: styles.amountSettled, label: t('cashier.workspace.settled') };
}

export default function CashierReadOnlyOrderList({
  orders,
  selectedOrderId,
  timeZone,
  onSelectOrder,
  onOrderRowRef,
}: CashierReadOnlyOrderListProps) {
  const { t, i18n } = useTranslation();

  return (
    <ul className={styles.orderList} aria-label={t('cashier.workspace.order_list')}>
      {orders.map((order) => {
        const due = amountDue(order);
        const duePresentation = amountPresentation(due, order, t);
        const selected = selectedOrderId?.toLowerCase() === order.id.toLowerCase();
        return (
          <li key={order.id} className={styles.orderListItem}>
            <button
              ref={(node) => onOrderRowRef?.(order.id, node)}
              type="button"
              className={`${styles.orderRow} ${selected ? styles.orderRowSelected : ''}`}
              onClick={() => onSelectOrder(order.id)}
              aria-current={selected ? 'true' : undefined}
              aria-describedby={`cashier-order-${order.id}-description`}
            >
              <span id={`cashier-order-${order.id}-description`} className="sr-only">
                {t('cashier.workspace.open_order', { order: order.orderNumber })}
              </span>
              <span className={styles.orderRowTop}>
                <span className={styles.orderNumber} dir="auto">
                  {order.orderNumber}
                </span>
                <OrderStatusBadge status={order.status} />
              </span>
              <span className={styles.orderRowMeta}>
                <span>{orderTypeLabel(order.type, t)}</span>
                {order.tableNumber !== undefined && (
                  <span>{t('cashier.workspace.table_value', { table: order.tableNumber })}</span>
                )}
                <time dateTime={order.orderDate}>{orderTime(order.orderDate, i18n.language, timeZone, t)}</time>
              </span>
              <span className={styles.orderRowBottom}>
                <span dir="auto">{order.customerName || t('cashier.workspace.guest')}</span>
                <span className={duePresentation.className}>{duePresentation.label}</span>
              </span>
              <span className={styles.paymentState}>{paymentStatusLabel(order.paymentStatus, t)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
