'use client';

import { useTranslation } from 'react-i18next';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StaffButton from '@/components/design-system/StaffButton';
import OrderLineSummary from '@/components/order/OrderLineSummary';
import { orderItemToLineSummary } from '@/components/order/lineSummary';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import type { OrderDto } from '@/types/order';
import styles from './OrderAmendmentHistorySection.module.css';

interface Props {
  readonly order: OrderDto;
  readonly onSelectOrder?: (orderId: string) => void;
}

export default function OrderRoundHistoryRecord({ order, onSelectOrder }: Props) {
  const { t } = useTranslation();
  return (
    <li className={styles.record}>
      <header className={styles.recordHeader}>
        <strong dir="auto">
          {getOrderDisplayNumber(order)} · {order.customerName || t('cashier.workspace.guest')}
        </strong>
        <OrderStatusBadge status={order.status} />
        <strong>{formatOrderCurrency(order.total, order)}</strong>
      </header>
      <ul className={styles.supplementItems}>
        {order.items.map((item) => (
          <li key={item.id}>
            <strong dir="auto">
              {item.quantity}× {item.productName || item.menuName}
            </strong>
            <OrderLineSummary line={orderItemToLineSummary(item)} />
          </li>
        ))}
      </ul>
      {onSelectOrder && (
        <StaffButton onClick={() => onSelectOrder(order.id)}>
          {t('cashier.workspace.open_order', { order: getOrderDisplayNumber(order) })}
        </StaffButton>
      )}
    </li>
  );
}
