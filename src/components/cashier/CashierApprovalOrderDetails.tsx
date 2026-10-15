'use client';

import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { channelLabel } from './cashierConfirmModalConfig';
import { TicketItems } from './CashierReadOnlyTicketSections';
import technicalReferenceStyles from './CashierTechnicalReference.module.css';
import styles from './CashierConfirmModal.module.css';

interface CashierApprovalOrderDetailsProps {
  readonly order: OrderDto;
  readonly preparationMinutes: number | null;
}

/** Full order facts remain visible in the scrollable modal body while its decisions stay pinned. */
export default function CashierApprovalOrderDetails({ order, preparationMinutes }: CashierApprovalOrderDetailsProps) {
  const { t } = useTranslation();
  const summary = [
    { label: t('order_number'), value: getOrderDisplayNumber(order) },
    { label: t('type'), value: channelLabel(order.type, t) },
    { label: t('customer'), value: order.customerName || t('cashier.workspace.guest') },
    ...(order.customerPhone ? [{ label: t('phone'), value: order.customerPhone }] : []),
    ...(order.customerEmail ? [{ label: t('email'), value: order.customerEmail }] : []),
    { label: t('cashier.workspace.order_total'), value: formatOrderCurrency(order.total, order) },
  ];

  return (
    <>
      <dl className={styles.summary}>
        {summary.map((row) => (
          <div key={row.label} className={styles.summaryRow}>
            <dt>{row.label}</dt>
            <dd dir="auto">{row.value}</dd>
          </div>
        ))}
      </dl>
      <section className={styles.orderDetail} aria-labelledby="cashier-approval-order-items">
        <h3 id="cashier-approval-order-items">{t('cashier.workspace.items')}</h3>
        <TicketItems items={order.items ?? []} currency={order.currency} t={t} />
        <p className={styles.orderTotal}>
          <span>{t('cashier.workspace.order_total')}</span>
          <strong>{formatOrderCurrency(order.total, order)}</strong>
        </p>
      </section>
      {preparationMinutes !== null && (
        <p className={styles.preparationEstimate}>
          {t('cashier.workspace.preparation_estimate', { minutes: preparationMinutes })}
        </p>
      )}
      <section className={styles.orderDetail} aria-labelledby="cashier-approval-customer-details">
        <h3 id="cashier-approval-customer-details">{t('cashier.workspace.customer_details')}</h3>
        <dl className={styles.summary}>
          {order.tableNumber !== undefined && order.tableNumber !== null && (
            <div className={styles.summaryRow}>
              <dt>{t('cashier.workspace.table')}</dt>
              <dd>{t('cashier.workspace.table_value', { table: order.tableNumber })}</dd>
            </div>
          )}
          {order.deliveryAddress && (
            <div className={styles.summaryRow}>
              <dt>{t('cashier.workspace.delivery_address')}</dt>
              <dd dir="auto">{order.deliveryAddress.fullAddress}</dd>
            </div>
          )}
          {order.notes && (
            <div className={styles.summaryRow}>
              <dt>{t('cashier.workspace.notes')}</dt>
              <dd dir="auto">{order.notes}</dd>
            </div>
          )}
        </dl>
      </section>
      <details className={technicalReferenceStyles.details}>
        <summary>{t('cashier.workspace.technical_reference')}</summary>
        <p>
          {t('order_number')}: <code>{order.orderNumber}</code>
        </p>
        <p>
          {t('cashier.workspace.technical_reference')}: <code>{order.id}</code>
        </p>
      </details>
    </>
  );
}
