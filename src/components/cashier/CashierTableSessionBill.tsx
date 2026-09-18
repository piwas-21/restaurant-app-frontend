'use client';

import { useTranslation } from 'react-i18next';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { OrderDto, TableBillRoundDto, TableServiceSessionDto } from '@/types/order';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import {
  formatTableMoney,
  tableOrderSettlementState,
  tableSessionCredit,
  tableSessionEligibleOutstanding,
  type TableOrderSettlementState,
} from '@/lib/cashierTableSession';
import styles from './CashierTableSession.module.css';

interface CashierTableSessionBillProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
}

type DisplayRound = Pick<TableBillRoundDto, 'settlementState' | 'outstanding' | 'credit'> & { order: OrderDto };

function settlementStateFor(settlement: TableOrderSettlementState): DisplayRound['settlementState'] {
  switch (settlement) {
    case 'eligible':
      return 'EligibleDebt';
    case 'credit':
      return 'Credit';
    case 'refunded':
      return 'Refunded';
    case 'settled':
      return 'Settled';
    default:
      return 'Cancelled';
  }
}

function fallbackRound(order: OrderDto): DisplayRound {
  const settlementState = settlementStateFor(tableOrderSettlementState(order));
  return {
    order,
    settlementState,
    outstanding: Math.max(0, order.remainingAmount),
    credit: Math.max(0, -order.remainingAmount),
  };
}

function displayRounds(session: TableServiceSessionDto): DisplayRound[] {
  if (session.bill.rounds && session.bill.rounds.length > 0) return session.bill.rounds;
  return session.bill.orders.map(fallbackRound);
}

function SettlementBadge({ round, t }: Readonly<{ round: DisplayRound; t: (key: string) => string }>) {
  if (round.settlementState === 'EligibleDebt') {
    return <StatusBadge tone="warning">{t('cashier.tables.round_eligible')}</StatusBadge>;
  }
  if (round.settlementState === 'Settled') {
    return <StatusBadge tone="success">{t('cashier.tables.round_settled')}</StatusBadge>;
  }
  if (round.settlementState === 'Credit') {
    return <StatusBadge tone="warning">{t('cashier.tables.round_credit')}</StatusBadge>;
  }
  if (round.settlementState === 'PartiallyRefunded') {
    return <StatusBadge tone="danger">{t('cashier.tables.round_partially_refunded')}</StatusBadge>;
  }
  if (round.settlementState === 'Refunded') {
    return <StatusBadge tone="danger">{t('cashier.tables.round_refunded')}</StatusBadge>;
  }
  return <OrderStatusBadge status={round.order.status} />;
}

export default function CashierTableSessionBill({ session, timeZone }: CashierTableSessionBillProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const money = (amount: number | null | undefined) =>
    formatTableMoney(amount, session) ?? t('cashier.tables.currency_unknown');
  const rounds = displayRounds(session);
  const credit = tableSessionCredit(session);
  return (
    <section className={styles.bill} aria-labelledby="cashier-table-bill-title">
      <h3 id="cashier-table-bill-title">{t('cashier.tables.bill')}</h3>
      <div className={styles.billScroll}>
        {rounds.length === 0 && <p className={styles.muted}>{t('cashier.tables.no_rounds')}</p>}
        {rounds.map((round) => {
          const { order } = round;
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
                  <SettlementBadge round={round} t={t} />
                </div>
                <strong className={styles.lineTotal}>{money(order.total)}</strong>
              </header>
              <ul className={styles.lineList}>
                {order.items.map((item, index) => (
                  <li key={item.id || `${order.id}-${index}`} className={styles.line}>
                    <span>{item.quantity}×</span>
                    <div className={styles.lineName}>
                      <span dir="auto">
                        {item.productName || item.menuName || t('cashier.tables.unknown_item')}
                        {item.variationName ? ` — ${item.variationName}` : ''}
                      </span>
                      <OrderLineSummary line={orderItemToLineSummary(item)} />
                    </div>
                    <span className={styles.lineTotal}>{money(item.itemTotal)}</span>
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
          <span className={styles.totalValue}>{money(session.bill.total)}</span>
        </div>
        <div className={styles.totalRow}>
          <span>{t('cashier.tables.paid')}</span>
          <span className={styles.totalValue}>{money(session.bill.totalPaid)}</span>
        </div>
        {credit > 0 && (
          <div className={styles.totalRow}>
            <span>{t('cashier.tables.round_credit')}</span>
            <span className={styles.totalValue}>{money(credit)}</span>
          </div>
        )}
        <div className={styles.totalRow}>
          <strong>{t('cashier.tables.outstanding')}</strong>
          <strong className={styles.totalValue}>{money(tableSessionEligibleOutstanding(session))}</strong>
        </div>
      </div>
    </section>
  );
}
