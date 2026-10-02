'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FilePenLine, Search } from 'lucide-react';
import { useOptionalAuth } from '@/components/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { readPendingAmendmentCommit, type PendingAmendmentRead } from '@/hooks/orderAmendments/pendingAmendmentCommit';
import type { OrderDto } from '@/types/order';
import styles from './OrderAmendmentEntryButton.module.css';

const OrderAmendmentModal = dynamic(() => import('./OrderAmendmentModal'));

interface OrderAmendmentEntryButtonProps {
  readonly order: OrderDto;
  readonly operatorRole: 'Server' | 'Cashier' | 'Admin';
  readonly onCommitted?: () => void;
  readonly showFeatureDisabledNotice?: boolean;
}

interface RecoveryAvailability {
  readonly identity: string | null;
  readonly status: PendingAmendmentRead['status'] | 'loading';
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
  showFeatureDisabledNotice = true,
}: Readonly<OrderAmendmentEntryButtonProps>) {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const auth = useOptionalAuth();
  const actorId = auth?.user?.userId;
  const [isOpen, setIsOpen] = useState(false);
  const [recoveryAvailability, setRecoveryAvailability] = useState<RecoveryAvailability>({
    identity: null,
    status: 'loading',
  });
  const recoveryIdentity = actorId ? `${actorId}\u0000${order.id}` : null;

  useEffect(() => {
    if (auth?.isLoading) {
      setRecoveryAvailability({ identity: null, status: 'loading' });
      return;
    }
    if (!actorId) {
      setRecoveryAvailability({ identity: null, status: 'none' });
      return;
    }
    setRecoveryAvailability({
      identity: `${actorId}\u0000${order.id}`,
      status: readPendingAmendmentCommit(actorId, order.id).status,
    });
  }, [actorId, auth?.isLoading, order.id]);

  const reason = unsupportedReason(order);
  const recoveryOnly = !orderAmendmentsV1 || reason !== null;
  const canRecover = Boolean(
    actorId &&
    !auth?.isLoading &&
    recoveryAvailability.identity === recoveryIdentity &&
    recoveryAvailability.status !== 'loading' &&
    recoveryAvailability.status !== 'none',
  );

  if (!recoveryOnly) {
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

  if (!orderAmendmentsV1 && !canRecover) return null;

  const unavailableKey =
    !orderAmendmentsV1 && showFeatureDisabledNotice
      ? 'orderAmendments.feature_disabled'
      : reason
        ? `orderAmendments.${reason}`
        : null;
  if (!canRecover && !unavailableKey) return null;

  return (
    <>
      {unavailableKey && <p className={styles.unavailable}>{t(unavailableKey)}</p>}
      {canRecover && (
        <button type="button" className={styles.action} onClick={() => setIsOpen(true)}>
          <Search size={17} aria-hidden="true" />
          {t('orderAmendments.check_operation', 'Check the original operation')}
        </button>
      )}
      {isOpen && (
        <OrderAmendmentModal
          order={order}
          operatorRole={operatorRole}
          recoveryOnly
          onClose={() => setIsOpen(false)}
          onCommitted={onCommitted}
        />
      )}
    </>
  );
}
