'use client';

import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import { orderStatusPresentation } from '@/lib/orderStatusPresentation';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import type { OrderDto } from '@/types/order';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './CashierWorkspaceList.module.css';

interface CashierReadOnlyOrderListProps {
  readonly orders: readonly OrderDto[];
  readonly selectedOrderId: string | null;
  readonly onSelectOrder: (orderId: string) => void;
}

function orderTypeLabel(type: string, t: TFunction): string {
  if (type === 'DineIn') return t('cashier.workspace.channel_dine_in');
  if (type === 'Takeaway') return t('cashier.workspace.channel_takeaway');
  if (type === 'Delivery') return t('cashier.workspace.channel_delivery');
  return type;
}

function orderTime(orderDate: string, language: string, t: TFunction): string {
  const date = new Date(orderDate);
  if (Number.isNaN(date.getTime())) return t('cashier.workspace.unknown_time');
  return date.toLocaleString(language || 'en', { dateStyle: 'short', timeStyle: 'short' });
}

function amountDue(order: OrderDto): number {
  if (typeof order.remainingAmount === 'number') return order.remainingAmount;
  return order.total - order.totalPaid;
}

export default function CashierReadOnlyOrderList({
  orders,
  selectedOrderId,
  onSelectOrder,
}: CashierReadOnlyOrderListProps) {
  const { t, i18n } = useTranslation();

  return (
    <ul className={styles.orderList} aria-label={t('cashier.workspace.order_list')}>
      {orders.map((order) => {
        const status = orderStatusPresentation(order.status, t);
        const due = amountDue(order);
        const selected = selectedOrderId?.toLowerCase() === order.id.toLowerCase();
        return (
          <li key={order.id} className={styles.orderListItem}>
            <button
              type="button"
              className={`${styles.orderRow} ${selected ? styles.orderRowSelected : ''}`}
              onClick={() => onSelectOrder(order.id)}
              aria-current={selected ? 'true' : undefined}
              aria-label={t('cashier.workspace.open_order', { order: order.orderNumber })}
            >
              <span className={styles.orderRowTop}>
                <span className={styles.orderNumber}>{order.orderNumber}</span>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </span>
              <span className={styles.orderRowMeta}>
                <span>{orderTypeLabel(order.type, t)}</span>
                {order.tableNumber !== undefined && (
                  <span>{t('cashier.workspace.table_value', { table: order.tableNumber })}</span>
                )}
                <time dateTime={order.orderDate}>{orderTime(order.orderDate, i18n.language, t)}</time>
              </span>
              <span className={styles.orderRowBottom}>
                <span>{order.customerName || t('cashier.workspace.guest')}</span>
                <span className={due > 0 ? styles.amountDue : due < 0 ? styles.amountCredit : styles.amountSettled}>
                  {due > 0
                    ? t('cashier.workspace.due_value', { amount: formatPlainCurrency(due) })
                    : due < 0
                      ? t('cashier.workspace.credit_value', { amount: formatPlainCurrency(Math.abs(due)) })
                      : t('cashier.workspace.settled')}
                </span>
              </span>
              <span className={styles.paymentState}>{paymentStatusLabel(order.paymentStatus, t)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
