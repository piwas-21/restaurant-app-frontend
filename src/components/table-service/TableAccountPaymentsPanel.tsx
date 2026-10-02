'use client';

import { useTranslation } from 'react-i18next';
import { PaymentRows } from '@/components/cashier/CashierReadOnlyTicketSections';
import type { TableServiceSessionDto } from '@/types/order';
import styles from './TableAccountWorkspace.module.css';

export default function TableAccountPaymentsPanel({ session }: Readonly<{ session: TableServiceSessionDto }>) {
  const { t } = useTranslation();
  const orders = session.bill.orders;
  const ordersWithPayments = orders.filter((order) => (order.payments?.length ?? 0) > 0);

  if (ordersWithPayments.length === 0) {
    return <p className={styles.empty}>{t('cashier.workspace.no_payments')}</p>;
  }

  return (
    <div className={styles.paymentHistory}>
      <p className={styles.note}>{t('cashier.tables.account_payment_allocation_unavailable')}</p>
      {ordersWithPayments.map((order) => (
        <section key={order.id} className={styles.paymentOrder} aria-label={order.orderNumber}>
          <h4 dir="auto">{order.orderNumber}</h4>
          <PaymentRows payments={order.payments ?? []} currency={session.currency} t={t} showRefundedAmounts />
        </section>
      ))}
    </div>
  );
}
