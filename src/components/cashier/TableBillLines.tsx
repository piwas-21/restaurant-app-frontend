'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import { OrderStatus, TableBillDto } from '@/types/order';
import { formatPlainCurrency } from '@/utils/currency';
import { getOrderStatusTranslationKey } from '@/utils/orderStatusStyles';
import styles from './TableBillModal.module.css';

/**
 * The per-order groups of a table's bill: one section per ordering round, in
 * the order the table placed them (the assembler orders oldest-first), each
 * with its number, time, status badge and lines. Line totals are the
 * backend-computed `itemTotal`; a fully-paid round reads as settled.
 */
/** A settled round is green; otherwise the order's own status drives the badge. */
const badgeTone = (order: TableBillDto['orders'][number]) => {
  if (order.remainingAmount <= 0) return 'success';
  if (order.status === 'Ready') return 'info';
  return 'warning';
};

const badgeLabel = (order: TableBillDto['orders'][number], t: TFunction<'translation', undefined>) =>
  order.remainingAmount <= 0
    ? t('cashier.table_bill.settled', 'Settled')
    : t(getOrderStatusTranslationKey(order.status as OrderStatus), order.status);

export default function TableBillLines({ bill }: Readonly<{ bill: TableBillDto }>) {
  const { t, i18n } = useTranslation();

  return (
    <>
      {bill.orders.map((order) => (
        <section key={order.id} className={styles.orderGroup} aria-label={order.orderNumber}>
          <header className={styles.orderGroupHeader}>
            <span className={styles.orderNumber}>{order.orderNumber}</span>
            {/* i18n.language, NOT [] — the browser locale is invisible to the i18n gates
                (CLAUDE.md §8) and the tenant UI must follow the chosen language. */}
            <span className={styles.orderMeta}>
              {new Date(order.orderDate).toLocaleTimeString(i18n.language || 'en', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <StatusBadge tone={badgeTone(order)}>{badgeLabel(order, t)}</StatusBadge>
            <span className={styles.orderTotal}>{formatPlainCurrency(order.total)}</span>
          </header>
          <ul className={styles.lineList}>
            {order.items.map((item, index) => (
              <li key={`${order.id}-${index}`} className={styles.line}>
                <span className={styles.lineQty}>{item.quantity}×</span>
                <span className={styles.lineName}>
                  {item.productName || item.menuName || t('cashier.table_bill.item', 'Item')}
                  {item.variationName ? ` — ${item.variationName}` : ''}
                </span>
                {/* itemTotal is the backend-computed line total (price incl. customizations). */}
                <span className={styles.lineTotal}>{formatPlainCurrency(item.itemTotal)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
