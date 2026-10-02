'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { FilePenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import type { OrderDto } from '@/types/order';
import styles from './OrderAmendmentEntryButton.module.css';

const OrderAmendmentModal = dynamic(() => import('./OrderAmendmentModal'));

interface OrderAmendmentEntryButtonProps {
  readonly order: OrderDto;
  readonly operatorRole: 'Server' | 'Cashier' | 'Admin';
  readonly onCommitted?: () => void;
}

export function unsupportedReason(
  order: OrderDto,
): 'order_type_unavailable' | 'cancelled_order' | 'fully_refunded_order' | 'order_refund_activity' | null {
  if (!['DineIn', 'Takeaway', 'Delivery'].includes(order.type)) return 'order_type_unavailable';
  if (order.status === 'Cancelled') return 'cancelled_order';
  if (order.status === 'Refunded') return 'fully_refunded_order';
  if (
    order.paymentStatus === 'Refunded' ||
    order.paymentStatus === 'PartiallyRefunded' ||
    order.payments?.some(
      (payment) =>
        payment.status === 'Refunded' ||
        payment.status === 'PartiallyRefunded' ||
        payment.isRefunded === true ||
        payment.refundedAmount != null ||
        payment.refundDate != null,
    )
  ) {
    return 'order_refund_activity';
  }
  return null;
}

export default function OrderAmendmentEntryButton({
  order,
  operatorRole,
  onCommitted,
}: Readonly<OrderAmendmentEntryButtonProps>) {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const [isOpen, setIsOpen] = useState(false);
  if (!orderAmendmentsV1) return null;

  const reason = unsupportedReason(order);
  if (reason) {
    return <p className={styles.unavailable}>{t(`orderAmendments.${reason}`)}</p>;
  }

  return (
    <>
      <button type="button" className={styles.action} onClick={() => setIsOpen(true)}>
        <FilePenLine size={17} aria-hidden="true" />
        {t('orderAmendments.open', 'Amend order')}
      </button>
      {isOpen && (
        <OrderAmendmentModal
          order={order}
          operatorRole={operatorRole}
          onClose={() => setIsOpen(false)}
          onCommitted={onCommitted}
        />
      )}
    </>
  );
}
