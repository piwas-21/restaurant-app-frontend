'use client';

import { useTranslation } from 'react-i18next';
import type { TableGuestAccountDto, TableGuestOrderDto } from '@/types/tableGuestVisit';
import TableGuestAccountLine from './TableGuestAccountLine';
import styles from './TableGuestAccount.module.css';

interface TableGuestAccountBatchProps {
  readonly order: TableGuestOrderDto;
  readonly account: TableGuestAccountDto;
  readonly formatPrice: (amount: number) => string;
}

export default function TableGuestAccountBatch({ order, account, formatPrice }: TableGuestAccountBatchProps) {
  const { t, i18n } = useTranslation();
  const items = account.items.filter((line) => line.orderId === order.orderId);
  const orderDate = new Date(order.orderDate);

  return (
    <details className={styles.batch}>
      <summary className={styles.batchSummary}>
        <span>
          <strong>{t('table_guest_kitchen_batch', { number: order.orderNumber })}</strong>
          {Number.isFinite(orderDate.getTime()) && (
            <time dateTime={order.orderDate}>{orderDate.toLocaleString(i18n.language)}</time>
          )}
        </span>
        <strong>{formatPrice(order.total)}</strong>
      </summary>
      <ul className={styles.items}>
        {items.map((line) => (
          <TableGuestAccountLine
            key={`${line.orderId}:${line.item.itemId}`}
            item={line.item}
            quantity={line.unitCount}
            formatPrice={formatPrice}
          />
        ))}
      </ul>
    </details>
  );
}
