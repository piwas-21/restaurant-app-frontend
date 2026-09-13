'use client';

import { useTranslation } from 'react-i18next';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { TableServiceSessionDto } from '@/types/order';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import { formatTableMoney } from '@/lib/cashierTableSession';
import styles from './CashierTableSession.module.css';

interface CashierTableSessionBillProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
}

export default function CashierTableSessionBill({ session, timeZone }: CashierTableSessionBillProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  return (
    <section className={styles.bill} aria-labelledby="cashier-table-bill-title">
      <h3 id="cashier-table-bill-title">{t('cashier.tables.bill')}</h3>
      <div className={styles.billScroll}>
        {session.bill.orders.length === 0 && <p className={styles.muted}>{t('cashier.tables.no_rounds')}</p>}
        {session.bill.orders.map((order) => {
          const settled = order.remainingAmount <= 0;
          const orderTime = formatCashierDateTime(
            order.orderDate,
            locale,
            timeZone,
            'short',
            t('cashier.tables.unknown_time'),
          );
          return (
            <article key={order.id} className={styles.round}>
              <header className={styles.roundHeader}>
                <div className={styles.roundIdentity}>
                  <strong dir="auto">{order.orderNumber}</strong>
                  <span className={styles.roundTime}>{orderTime}</span>
                  {settled ? (
                    <StatusBadge tone="success">{t('cashier.tables.round_settled')}</StatusBadge>
                  ) : (
                    <OrderStatusBadge status={order.status} />
                  )}
                </div>
                <strong className={styles.lineTotal}>{formatTableMoney(order.total, session)}</strong>
              </header>
              <ul className={styles.lineList}>
                {order.items.map((item, index) => (
                  <li key={item.id || `${order.id}-${index}`} className={styles.line}>
                    <span>{item.quantity}×</span>
                    <span className={styles.lineName} dir="auto">
                      {item.productName || item.menuName || t('cashier.tables.unknown_item')}
                      {item.variationName ? ` — ${item.variationName}` : ''}
                    </span>
                    <span className={styles.lineTotal}>{formatTableMoney(item.itemTotal, session)}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <div className={styles.totals} aria-live="polite">
        <div className={styles.totalRow}>
          <span>{t('cashier.tables.total')}</span>
          <span className={styles.totalValue}>{formatTableMoney(session.bill.total, session)}</span>
        </div>
        <div className={styles.totalRow}>
          <span>{t('cashier.tables.paid')}</span>
          <span className={styles.totalValue}>{formatTableMoney(session.bill.totalPaid, session)}</span>
        </div>
        <div className={styles.totalRow}>
          <strong>{t('cashier.tables.outstanding')}</strong>
          <strong className={styles.totalValue}>{formatTableMoney(session.outstanding, session)}</strong>
        </div>
      </div>
    </section>
  );
}
