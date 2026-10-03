'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FilePenLine, Search } from 'lucide-react';
import { useAccountPaymentActor, type AccountPaymentActor } from '@/hooks/accountPayments/useAccountPaymentActor';
import { useOrderAmendmentEligibility } from '@/hooks/orderAmendments/useOrderAmendmentEligibility';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { readPendingAmendmentCommit, type PendingAmendmentRead } from '@/hooks/orderAmendments/pendingAmendmentCommit';
import { useOrderAmendmentTranslations } from '@/hooks/orderAmendments/useOrderAmendmentTranslations';
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
): 'order_type_unavailable' | 'cancelled_order' | 'fully_refunded_order' | null {
  if (!['DineIn', 'Takeaway', 'Delivery'].includes(order.type)) return 'order_type_unavailable';
  if (order.status === 'Cancelled') return 'cancelled_order';
  if (order.status === 'Refunded') return 'fully_refunded_order';
  return null;
}

function actorReason(actor: AccountPaymentActor, eligibilityReason: string | null): string | null {
  if (actor.status === 'failed') return 'orderAmendments.resolution_context_failed';
  if (actor.status === 'checking') return 'orderAmendments.resolution_checking';
  return eligibilityReason;
}

function unavailableReason(enabled: boolean, showNotice: boolean, reason: string | null): string | null {
  if (!enabled) return showNotice ? 'orderAmendments.feature_disabled' : null;
  return reason;
}

function retryEligibility(actor: AccountPaymentActor, refresh: (() => void) | undefined, retry: () => void) {
  if (actor.status === 'failed') actor.retry();
  else {
    refresh?.();
    retry();
  }
}

export default function OrderAmendmentEntryButton({
  order,
  operatorRole,
  onCommitted,
  showFeatureDisabledNotice = true,
}: Readonly<OrderAmendmentEntryButtonProps>) {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  const actor = useAccountPaymentActor();
  const actorId = actor.actorId;
  const [isOpen, setIsOpen] = useState(false);
  const [recoveryAvailability, setRecoveryAvailability] = useState<RecoveryAvailability>({
    identity: null,
    status: 'loading',
  });
  const recoveryIdentity = actorId ? `${actorId}\u0000${order.id}` : null;

  useEffect(() => {
    if (actor.status === 'checking') {
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
  }, [actorId, actor.status, order.id, order.version]);

  const localReason = unsupportedReason(order);
  const eligibility = useOrderAmendmentEligibility(order, actorId, orderAmendmentsV1 && !localReason);
  const reason = localReason ? `orderAmendments.${localReason}` : actorReason(actor, eligibility.reason);
  const recoveryOnly = !orderAmendmentsV1 || reason !== null;
  const canRecover = Boolean(
    actorId &&
    actor.status === 'ready' &&
    recoveryAvailability.identity === recoveryIdentity &&
    recoveryAvailability.status !== 'loading' &&
    recoveryAvailability.status !== 'none',
  );
  const translations = useOrderAmendmentTranslations(orderAmendmentsV1 || canRecover);

  if (!orderAmendmentsV1 && !canRecover) return null;
  if (!translations.ready) {
    return (
      <div>
        <output className={styles.unavailable} aria-live="polite" aria-atomic="true">
          {translations.failed
            ? t('error_unexpected', 'Order actions could not be loaded. Please try again.')
            : t('common.loading', 'Loading…')}
        </output>
        {translations.failed && (
          <button type="button" className={styles.action} onClick={translations.retry}>
            {t('retry', 'Retry')}
          </button>
        )}
      </div>
    );
  }

  if (!recoveryOnly && !canRecover) {
    return (
      <>
        <button type="button" className={styles.action} onClick={() => setIsOpen(true)}>
          <FilePenLine size={17} aria-hidden="true" />
          {t('orderAmendments.open', 'Amend order')}
        </button>
        {isOpen && (
          <OrderAmendmentModal
            key={`${actorId}:${order.id}`}
            order={order}
            operatorRole={operatorRole}
            resolvedActorId={actorId}
            onClose={() => setIsOpen(false)}
            onCommitted={onCommitted}
          />
        )}
      </>
    );
  }

  const unavailableKey = unavailableReason(orderAmendmentsV1, showFeatureDisabledNotice, reason);
  if (!canRecover && !unavailableKey) return null;
  const canRetryEligibility =
    orderAmendmentsV1 &&
    !localReason &&
    actor.status !== 'checking' &&
    reason !== 'orderAmendments.resolution_checking';

  return (
    <>
      {unavailableKey && <p className={styles.unavailable}>{t(unavailableKey)}</p>}
      {canRetryEligibility && !canRecover && (
        <button
          type="button"
          className={styles.action}
          onClick={() => retryEligibility(actor, onCommitted, eligibility.retry)}
        >
          {t('retry')}
        </button>
      )}
      {canRecover && (
        <button type="button" className={styles.action} onClick={() => setIsOpen(true)}>
          <Search size={17} aria-hidden="true" />
          {t('orderAmendments.check_operation', 'Check the original operation')}
        </button>
      )}
      {isOpen && (
        <OrderAmendmentModal
          key={`${actorId}:${order.id}`}
          order={order}
          operatorRole={operatorRole}
          recoveryOnly={recoveryOnly}
          resolvedActorId={actorId}
          onClose={() => setIsOpen(false)}
          onCommitted={onCommitted}
        />
      )}
    </>
  );
}
