'use client';

import { useTranslation } from 'react-i18next';
import type { TableGuestAccountDto, TableGuestOrderDto } from '@/types/tableGuestVisit';
import TableGuestAccountLine from './TableGuestAccountLine';
import styles from './TableGuestAccount.module.css';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import BusinessDateLabel from '@/components/design-system/BusinessDateLabel';
import { formatBusinessTime } from '@/lib/formatBusinessDate';

interface TableGuestAccountBatchProps {
  readonly order: TableGuestOrderDto;
  readonly account: TableGuestAccountDto;
  readonly formatPrice: (amount: number) => string;
  readonly businessTimeZone?: string;
}

export default function TableGuestAccountBatch({
  order,
  account,
  formatPrice,
  businessTimeZone,
}: TableGuestAccountBatchProps) {
  const { t, i18n } = useTranslation();
  const items = account.items.filter((line) => line.orderId === order.orderId);
  const orderDate = new Date(order.orderDate);
  const businessTime = formatBusinessTime(order.orderDate, i18n.language, businessTimeZone);

  return (
    <details className={styles.batch}>
      <summary className={styles.batchSummary}>
        <span>
          <strong>{t('table_guest_kitchen_batch', { number: getOrderDisplayNumber(order) })}</strong>
          <OrderTimestamp order={order} businessTime={businessTime} orderDate={orderDate} locale={i18n.language} />
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

function OrderTimestamp({
  order,
  businessTime,
  orderDate,
  locale,
}: Readonly<{
  order: TableGuestOrderDto;
  businessTime: string | null;
  orderDate: Date;
  locale: string;
}>) {
  if (order.businessDate) {
    return (
      <span className={styles.batchTimestamp}>
        <BusinessDateLabel businessDate={order.businessDate} />
        {businessTime && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={order.orderDate}>{businessTime}</time>
          </>
        )}
      </span>
    );
  }

  if (!Number.isFinite(orderDate.getTime())) return null;
  return <time dateTime={order.orderDate}>{orderDate.toLocaleString(locale)}</time>;
}
