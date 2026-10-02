'use client';

import { useTranslation } from 'react-i18next';
import type { OrderDto, TableServiceSessionDto } from '@/types/order';
import { formatTableMoney } from '@/lib/cashierTableSession';
import styles from './TableAccountTotals.module.css';

function AccountAmount({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className={styles.accountTotalRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function TableAccountTotals({ session }: Readonly<{ session: TableServiceSessionDto }>) {
  const { t } = useTranslation();
  const money = (amount: number | null | undefined) =>
    formatTableMoney(amount, session) ?? t('cashier.tables.currency_unknown');
  const orderAmounts = (order: OrderDto) =>
    [
      [t('subtotal'), order.subTotal],
      [t('discount'), order.discount],
      [t('customer_discount'), order.customerDiscountAmount],
      [t('server.points_discount'), order.fidelityPointsDiscount ?? 0],
      [t('delivery_fee'), order.deliveryFee],
      [t('tax'), order.tax],
      [t('tip'), order.tip],
      [t('total'), order.total],
    ] as const;

  return (
    <section className={styles.accountTotals} aria-label={t('cashier.tables.account_bill_totals')}>
      <h4>{t('cashier.tables.account_bill_totals')}</h4>
      <dl className={styles.accountTotalsGrid}>
        <AccountAmount label={t('subtotal')} value={money(session.bill.subTotal)} />
        <AccountAmount label={t('discount')} value={money(session.bill.discount)} />
        <AccountAmount label={t('tax')} value={money(session.bill.tax)} />
        <AccountAmount label={t('tip')} value={money(session.bill.tip)} />
        <AccountAmount label={t('total')} value={money(session.bill.total)} />
      </dl>
      {session.bill.orders.map((order) => (
        <details className={styles.accountOrderTotals} key={order.id}>
          <summary>
            <span>{t('cashier.tables.account_order', { order: order.orderNumber })}</span>
            <strong>{money(order.total)}</strong>
          </summary>
          <dl className={styles.accountTotalsGrid}>
            {orderAmounts(order).map(([label, amount], index) => (
              <div className={styles.accountTotalRow} key={`${order.id}-amount-${index}`}>
                <dt>{label}</dt>
                <dd>{money(amount)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </section>
  );
}
