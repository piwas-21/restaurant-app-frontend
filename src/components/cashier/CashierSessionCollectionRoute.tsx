'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '@/components/TenantLink';
import StaffButton from '@/components/design-system/StaffButton';
import { useCashierTableSession } from '@/hooks/cashier/useCashierTableSession';
import { useCashierSessionPendingTender } from '@/hooks/cashier/useCashierSessionPendingTender';
import type { PendingPaymentOperation } from '@/lib/cashierPendingPayment';
import { useServerAccountCollectionCapability } from '@/hooks/serverWorkspace/useServerAccountCollectionCapability';
import { tableSessionActions } from '@/lib/cashierTableSession';
import { pendingCashierTableNoticeLabel } from '@/lib/cashierTablePanelLabels';
import { CASHIER_ORDERS_PATH, CASHIER_TABLES_PATH } from '@/lib/cashierWorkspace';
import type { TableServiceSessionDto } from '@/types/order';
import CashierAccountPaymentCollectionHost from './CashierAccountPaymentCollectionHost';
import CashierTableSessionPaymentCollection from './CashierTableSessionPaymentCollection';
import CashierPendingPaymentNotice from './CashierPendingPaymentNotice';
import styles from './CashierCollection.module.css';

interface Props {
  readonly serviceSessionId: string;
  readonly orderId: string | null;
  readonly tableId?: string | null;
  readonly returnTo?: 'orders' | 'tables';
  readonly serverMode?: boolean;
  readonly externalWriteLocked?: boolean;
  readonly externalPendingPayment?: PendingPaymentOperation | null;
  readonly externalPaymentBusy?: boolean;
  readonly legacyTenderManagedExternally?: boolean;
  readonly onRetryExternalPayment?: () => void;
  readonly onNavigationLockChange?: (locked: boolean) => void;
}

function pendingTenderOrderScope(
  session: TableServiceSessionDto | null,
  managedExternally: boolean,
  orderId: string | null,
): string[] | undefined {
  if (!session) return undefined;
  return session.bill.orders
    .map((order) => order.id)
    .filter((id) => !managedExternally || id.toLowerCase() !== orderId?.toLowerCase());
}

function collectionReturnDestination(
  serverMode: boolean,
  serviceSessionId: string,
  tableId: string | null | undefined,
  session: TableServiceSessionDto | null,
  orderId: string | null,
  returnTo: 'orders' | 'tables' | undefined,
): { readonly path: string; readonly labelKey: string } {
  if (serverMode) {
    const id = tableId || session?.tableId;
    return id
      ? {
          path: `/server/tables/${encodeURIComponent(id)}?serviceSessionId=${encodeURIComponent(serviceSessionId)}`,
          labelKey: 'cashier.tables.back',
        }
      : { path: '/server/floor', labelKey: 'cashier.tables.back' };
  }
  if (returnTo === 'orders') return { path: CASHIER_ORDERS_PATH, labelKey: 'cashier.collection.back_orders' };
  if (returnTo === 'tables' || !orderId) {
    return {
      path: `${CASHIER_TABLES_PATH}?session=${encodeURIComponent(serviceSessionId)}`,
      labelKey: 'cashier.tables.back',
    };
  }
  return {
    path: `${CASHIER_ORDERS_PATH}?order=${encodeURIComponent(orderId)}`,
    labelKey: 'cashier.collection.back_orders',
  };
}

export default function CashierSessionCollectionRoute({
  serviceSessionId,
  orderId,
  tableId,
  returnTo,
  serverMode = false,
  externalWriteLocked = false,
  externalPendingPayment = null,
  externalPaymentBusy = false,
  legacyTenderManagedExternally = false,
  onRetryExternalPayment,
  onNavigationLockChange,
}: Props) {
  const { t } = useTranslation();
  const state = useCashierTableSession(serviceSessionId);
  const session = state.session;
  const pendingTenderOrderIds = pendingTenderOrderScope(session, legacyTenderManagedExternally, orderId);
  const pendingTender = useCashierSessionPendingTender({ orderIds: pendingTenderOrderIds });
  const loading = state.isLoading;
  const error = state.error;
  const [accountPaymentLocked, setAccountPaymentLocked] = useState(false);
  const [accountRefreshKey, setAccountRefreshKey] = useState(0);
  const [refreshingSettledTender, setRefreshingSettledTender] = useState(false);
  const settledRefreshStarted = useRef(false);
  const serverCanCollect = useServerAccountCollectionCapability(session);
  const refreshSession = state.refresh;
  const sessionOperationLocked = state.isMutating || state.isStale || state.pendingOperation !== null;
  const operationLocked =
    sessionOperationLocked || externalWriteLocked || pendingTender.blocking || refreshingSettledTender;
  const navigationLocked = operationLocked || accountPaymentLocked;
  const label =
    session?.tableLabel ||
    (session?.tableNumber
      ? t('cashier.tables.table_number', { table: session.tableNumber })
      : t('cashier.tables.table'));
  const returnDestination = collectionReturnDestination(
    serverMode,
    serviceSessionId,
    tableId,
    session,
    orderId,
    returnTo,
  );
  const originatingOrderNumber = session?.bill.orders.find(
    (order) => order.id.toLowerCase() === orderId?.toLowerCase(),
  )?.orderNumber;

  useEffect(() => {
    onNavigationLockChange?.(navigationLocked);
    return () => onNavigationLockChange?.(false);
  }, [navigationLocked, onNavigationLockChange]);

  useEffect(() => {
    if (pendingTender.status !== 'settled' || settledRefreshStarted.current) return;
    settledRefreshStarted.current = true;
    let active = true;
    setRefreshingSettledTender(true);
    void refreshSession().finally(() => {
      if (!active) return;
      setAccountRefreshKey((current) => current + 1);
      setRefreshingSettledTender(false);
    });
    return () => {
      active = false;
    };
  }, [pendingTender.status, refreshSession]);

  return (
    <section className={styles.collection} aria-labelledby="cashier-session-collection-title">
      <header className={styles.collectionHeader}>
        <Link
          className={styles.backButton}
          href={returnDestination.path}
          aria-disabled={navigationLocked ? 'true' : undefined}
          onClick={(event) => {
            if (navigationLocked) event.preventDefault();
          }}
        >
          {t(returnDestination.labelKey)}
        </Link>
        <div className={styles.orderIdentity}>
          <p className={styles.eyebrow}>{t('cashier.collection.session')}</p>
          <h1 id="cashier-session-collection-title" dir="auto">
            {label}
          </h1>
          {originatingOrderNumber && (
            <p>{t('cashier.collection.originating_order', { order: originatingOrderNumber })}</p>
          )}
        </div>
      </header>
      {loading && !session && <output aria-live="polite">{t('cashier.collection.order_loading')}</output>}
      {!loading && error && (
        <p className={styles.formError} role="alert">
          {error.startsWith('cashier.') ? t(error) : t('cashier.collection.order_load_failed')}
        </p>
      )}
      {state.pendingOperation && (
        <div role="status" aria-live="polite">
          <span>{pendingCashierTableNoticeLabel(state.pendingOperation, t)}</span>
          {state.pendingOperation.status === 'Unknown' && (
            <>
              <StaffButton
                onClick={() => void state.reconcilePendingOperation().catch(() => undefined)}
                disabled={state.isMutating}
              >
                {t('cashier.tables.operation_retry')}
              </StaffButton>
              <p>
                {t(
                  state.pendingOperation.kind === 'payment'
                    ? 'cashier.tables.reconciliation_unavailable'
                    : 'cashier.tables.close_recheck_hint',
                )}
              </p>
            </>
          )}
        </div>
      )}
      {externalPendingPayment && onRetryExternalPayment && (
        <CashierPendingPaymentNotice
          pendingPayment={externalPendingPayment}
          isBusy={externalPaymentBusy}
          onRetry={onRetryExternalPayment}
          t={t}
        />
      )}
      {!externalPendingPayment &&
        pendingTender.blocking &&
        (pendingTender.descriptor ? (
          <CashierPendingPaymentNotice
            pendingPayment={pendingTender.descriptor}
            isBusy={pendingTender.status === 'checking'}
            onRetry={() => void pendingTender.check().catch(() => undefined)}
            t={t}
          />
        ) : (
          <div role="alert" aria-live="polite">
            <p>{t(pendingTender.error ?? 'cashier.payment_check_failed')}</p>
            <StaffButton
              onClick={() => void pendingTender.check().catch(() => undefined)}
              disabled={pendingTender.status === 'checking'}
            >
              {t('cashier.collection.retry_payment_check')}
            </StaffButton>
          </div>
        ))}
      {session && serverMode && (
        <CashierAccountPaymentCollectionHost
          key={`${serviceSessionId}:${accountRefreshKey}`}
          session={session}
          disabled={operationLocked || !serverCanCollect}
          recoveryEnabled={!sessionOperationLocked}
          canStartCollection={serverCanCollect}
          showActorFailure
          onUpdated={() => void state.refresh()}
          onNavigationLockChange={setAccountPaymentLocked}
          fallback={null}
        />
      )}
      {session && !serverMode && (
        <CashierTableSessionPaymentCollection
          key={`${serviceSessionId}:${accountRefreshKey}`}
          session={session}
          locked={operationLocked}
          recoveryBlocked={sessionOperationLocked}
          canCollect={tableSessionActions(session).has('collect')}
          onUpdated={() => void state.refresh()}
          onNavigationLockChange={setAccountPaymentLocked}
          onSubmitPayment={async (payment) => {
            await state.submitPayment(payment);
          }}
        />
      )}
    </section>
  );
}
