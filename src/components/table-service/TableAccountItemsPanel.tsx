'use client';

import { useTranslation } from 'react-i18next';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { OrderDto, TableServiceSessionDto } from '@/types/order';
import { formatTableMoney } from '@/lib/cashierTableSession';
import TableAccountTotals from './TableAccountTotals';
import panelStyles from './TableAccountItemsPanel.module.css';
import styles from './TableAccountWorkspace.module.css';

type RefundLabel = 'refunded' | 'partially_refunded';

function orderRefundLabel(order: OrderDto | undefined, settlementState?: string): RefundLabel | null {
  if (settlementState === 'Refunded') return 'refunded';
  if (settlementState === 'PartiallyRefunded') return 'partially_refunded';
  if (!order) return null;
  if (order.status === 'Refunded' || order.paymentStatus === 'Refunded') return 'refunded';

  const refundSummary = order.payments.reduce(
    (summary, payment) => {
      const captured =
        payment.status === 'Completed' ||
        payment.status === 'PartiallyRefunded' ||
        payment.status === 'Refunded' ||
        payment.isRefunded === true;
      const refunded =
        payment.status === 'Refunded' || payment.isRefunded === true
          ? payment.amount
          : Math.max(0, payment.refundedAmount ?? 0);
      return {
        capturedAmount: summary.capturedAmount + (captured ? payment.amount : 0),
        refundedAmount: summary.refundedAmount + refunded,
        hasRefund: summary.hasRefund || refunded > 0 || payment.status === 'PartiallyRefunded',
      };
    },
    { capturedAmount: 0, refundedAmount: 0, hasRefund: false },
  );

  if (
    refundSummary.hasRefund &&
    refundSummary.capturedAmount > 0 &&
    refundSummary.refundedAmount >= refundSummary.capturedAmount
  ) {
    return 'refunded';
  }
  return order.paymentStatus === 'PartiallyRefunded' || refundSummary.hasRefund ? 'partially_refunded' : null;
}

export default function TableAccountItemsPanel({ session }: Readonly<{ session: TableServiceSessionDto }>) {
  const { t } = useTranslation();
  const accountItems = session.bill.accountItems;
  const hasAccountItems = Array.isArray(accountItems);
  const emptyItemsMessage = hasAccountItems
    ? t('cashier.tables.no_rounds')
    : t('cashier.tables.account_items_unavailable');
  const ordersById = new Map(session.bill.orders.map((order) => [order.id, order]));
  const roundStatesByOrderId = new Map(
    (session.bill.rounds ?? []).map((round) => [round.order.id, round.settlementState]),
  );

  return (
    <div className={panelStyles.panel}>
      <p className={styles.note}>{t('cashier.tables.account_item_snapshot_note')}</p>
      {!hasAccountItems || accountItems.length === 0 ? (
        <p className={styles.empty}>{emptyItemsMessage}</p>
      ) : (
        <ul className={styles.items}>
          {accountItems.map((entry) => {
            const item = entry.itemSnapshot;
            const refundLabel = orderRefundLabel(
              ordersById.get(entry.orderId),
              roundStatesByOrderId.get(entry.orderId),
            );
            return (
              <li key={`${entry.orderId}:${entry.orderItemId}`} className={styles.item}>
                <span className={styles.quantity}>{entry.unitCount}×</span>
                <div className={styles.itemDetails}>
                  <strong dir="auto">
                    {item.productName || item.menuName || t('cashier.tables.unknown_item')}
                    {item.variationName ? ` — ${item.variationName}` : ''}
                  </strong>
                  <span className={styles.orderRef} dir="auto">
                    {t('cashier.tables.account_order', { order: entry.orderNumber })}
                  </span>
                  {refundLabel && (
                    <StatusBadge tone="danger">{t(`cashier.tables.account_order_${refundLabel}`)}</StatusBadge>
                  )}
                  <OrderLineSummary line={orderItemToLineSummary(item)} />
                </div>
                <strong className={styles.amount}>
                  {formatTableMoney(item.itemTotal, session) ?? t('cashier.tables.currency_unknown')}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
      <TableAccountTotals session={session} />
    </div>
  );
}
