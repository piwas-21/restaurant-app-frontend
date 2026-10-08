'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FilePenLine, Search } from 'lucide-react';
import type { ReactNode } from 'react';
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

function canRetryAmendmentEligibility(
  enabled: boolean,
  localReason: string | null,
  actor: AccountPaymentActor,
  reason: string | null,
): boolean {
  return enabled && !localReason && actor.status !== 'checking' && reason !== 'orderAmendments.resolution_checking';
}

function RecoveryActorState({ actor }: Readonly<{ actor: AccountPaymentActor }>) {
  const { t } = useTranslation();
  return (
    <div>
      <output className={styles.unavailable} aria-live="polite" aria-atomic="true">
        {t(actorReason(actor, null) ?? 'orderAmendments.resolution_checking')}
      </output>
      {actor.status === 'failed' && (
        <button type="button" className={styles.action} onClick={actor.retry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}

interface EntryButtonContentProps {
  readonly enabled: boolean;
  readonly canRecover: boolean;
  readonly awaitingRecoveryActor: boolean;
  readonly translations: ReturnType<typeof useOrderAmendmentTranslations>;
  readonly actor: AccountPaymentActor;
  readonly recoveryOnly: boolean;
  readonly localReason: string | null;
  readonly reason: string | null;
  readonly showFeatureDisabledNotice: boolean;
  readonly onOpen: () => void;
  readonly onRetry: () => void;
  readonly t: ReturnType<typeof useTranslation>['t'];
}

function entryButtonContent(props: Readonly<EntryButtonContentProps>): ReactNode {
  if (!props.enabled && !props.canRecover && !props.awaitingRecoveryActor) return null;
  if (!props.translations.ready) {
    return (
      <div>
        <output className={styles.unavailable} aria-live="polite" aria-atomic="true">
          {props.translations.failed
            ? props.t('error_unexpected', 'Order actions could not be loaded. Please try again.')
            : props.t('common.loading', 'Loading…')}
        </output>
        {props.translations.failed && (
          <button type="button" className={styles.action} onClick={props.translations.retry}>
            {props.t('retry')}
          </button>
        )}
      </div>
    );
  }
  if (props.awaitingRecoveryActor) return <RecoveryActorState actor={props.actor} />;
  if (!props.recoveryOnly && !props.canRecover) {
    return (
      <button type="button" className={styles.action} onClick={props.onOpen}>
        <FilePenLine size={17} aria-hidden="true" />
        {props.t('orderAmendments.open', 'Amend order')}
      </button>
    );
  }

  const unavailableKey = unavailableReason(props.enabled, props.showFeatureDisabledNotice, props.reason);
  const canRetryEligibility = canRetryAmendmentEligibility(props.enabled, props.localReason, props.actor, props.reason);
  if (!props.canRecover && !unavailableKey) return null;
  return (
    <>
      {unavailableKey && <p className={styles.unavailable}>{props.t(unavailableKey)}</p>}
      {canRetryEligibility && !props.canRecover && (
        <button type="button" className={styles.action} onClick={props.onRetry}>
          {props.t('retry')}
        </button>
      )}
      {props.canRecover && (
        <button type="button" className={styles.action} onClick={props.onOpen}>
          <Search size={17} aria-hidden="true" />
          {props.t('orderAmendments.check_operation', 'Check the original operation')}
        </button>
      )}
    </>
  );
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
  const awaitingRecoveryActor = !orderAmendmentsV1 && actor.status !== 'ready';
  const translations = useOrderAmendmentTranslations(orderAmendmentsV1 || canRecover || awaitingRecoveryActor);
  const onOpen = () => setIsOpen(true);
  const onRetry = () => retryEligibility(actor, onCommitted, eligibility.retry);
  const content = entryButtonContent({
    enabled: orderAmendmentsV1,
    canRecover,
    awaitingRecoveryActor,
    translations,
    actor,
    recoveryOnly,
    localReason,
    reason,
    showFeatureDisabledNotice,
    onOpen,
    onRetry,
    t,
  });
  const modal = isOpen && actorId && translations.ready && (orderAmendmentsV1 || canRecover) && (
    <OrderAmendmentModal
      key={`${actorId}:${order.id}`}
      order={order}
      operatorRole={operatorRole}
      recoveryOnly={recoveryOnly}
      resolvedActorId={actorId}
      onClose={() => setIsOpen(false)}
      onCommitted={onCommitted}
    />
  );

  return (
    <>
      {content}
      {modal}
    </>
  );
}
