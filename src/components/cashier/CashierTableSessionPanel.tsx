'use client';

import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import type { PendingTableOperation } from '@/lib/cashierTablePending';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import { displayCashierTableError, pendingCashierTableNoticeLabel } from '@/lib/cashierTablePanelLabels';
import { formatTableMoney, tableSessionActions } from '@/lib/cashierTableSession';
import { sessionStatusLabel, sessionTableDisplay } from '@/lib/cashierTableLabels';
import CashierTableSessionBill from './CashierTableSessionBill';
import CashierTableSessionPaymentCollection from './CashierTableSessionPaymentCollection';
import TableAccountPresentation from '@/components/table-service/TableAccountPresentation';
import styles from './CashierTableSession.module.css';
import TableGuestAdmissionCodeSlot from '@/components/table-service/TableGuestAdmissionCodeSlot';
import CashierTableSessionConfirmationModals from './CashierTableSessionConfirmationModals';
import CashierTableSessionActions from './CashierTableSessionActions';

interface CashierTableSessionPanelProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
  readonly error: string | null;
  readonly isMutating: boolean;
  readonly isStale: boolean;
  readonly pendingOperation: PendingTableOperation | null;
  readonly hasLegacyConflict?: boolean;
  readonly isRepairingLegacyOrders?: boolean;
  readonly onResolveLegacyOrders?: () => void;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly onSubmitPayment: (payment: AddTableServiceSessionPaymentRequest) => Promise<void>;
  readonly onCloseSession: () => Promise<void>;
  readonly onReleaseTable: () => Promise<void>;
  readonly onClearAndReleaseTable: () => Promise<void>;
  readonly onReconcilePendingOperation: () => Promise<void>;
}

export default function CashierTableSessionPanel({
  session,
  timeZone,
  error,
  isMutating,
  isStale,
  pendingOperation,
  hasLegacyConflict = false,
  isRepairingLegacyOrders = false,
  onResolveLegacyOrders,
  onBack,
  onRefresh,
  onSubmitPayment,
  onCloseSession,
  onReleaseTable,
  onClearAndReleaseTable,
  onReconcilePendingOperation,
}: CashierTableSessionPanelProps) {
  const { t, i18n } = useTranslation();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const tableDisplay = sessionTableDisplay(session, t);
  const actions = tableSessionActions(session);
  const operationLocked = isMutating || pendingOperation !== null;
  const writesLocked = operationLocked || isStale;
  const legacyConflict = hasLegacyConflict || session.hasUnassignedActiveOrders === true;
  const message = displayCashierTableError(error, t);
  const opened = formatCashierDateTime(
    session.openedAt,
    i18n.language || 'en',
    timeZone,
    'medium',
    t('cashier.tables.unknown_time'),
  );

  const confirmClose = async () => {
    try {
      await onCloseSession();
      setShowCloseConfirm(false);
    } catch (_error) {
      // The refusal remains in the panel; a close is never silently retried.
    }
  };

  const confirmRelease = async () => {
    try {
      await onReleaseTable();
      setShowReleaseConfirm(false);
    } catch (_error) {
      // Keep the confirmation open so staff can review the refusal and try after resolving it.
    }
  };

  const confirmClearAndRelease = async () => {
    try {
      await onClearAndReleaseTable();
      setShowClearConfirm(false);
    } catch (_error) {
      // Keep the warning visible so the refusal is reviewed before another attempt.
    }
  };

  return (
    <section className={styles.session} aria-labelledby="cashier-table-session-title">
      <header className={styles.header}>
        <div className={styles.identity}>
          <StaffButton onClick={onBack} disabled={operationLocked}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('cashier.tables.back')}
          </StaffButton>
          <p className={styles.eyebrow}>{t('cashier.tables.session')}</p>
          <h2 id="cashier-table-session-title" dir="auto">
            {tableDisplay}
          </h2>
          <p className={styles.muted}>{t('cashier.tables.opened', { time: opened })}</p>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge tone={session.status === 'Open' ? 'success' : 'neutral'}>
            {session.isTableReleased ? t('cashier.tables.released_status') : sessionStatusLabel(session.status, t)}
          </StatusBadge>
          <StaffButton onClick={onRefresh} disabled={operationLocked}>
            <RefreshCw size={17} aria-hidden="true" />
            {t('cashier.workspace.refresh')}
          </StaffButton>
        </div>
      </header>

      {message && (
        <div className={styles.error} role="alert">
          {message}
        </div>
      )}
      {session.bill.isAmbiguous && (
        <div className={styles.warning} role="alert">
          {t('cashier.tables.ambiguous')}
        </div>
      )}
      {legacyConflict && (
        <div className={styles.warning} role="alert">
          <p>{t('cashier.tables.legacy_conflict')}</p>
          <StaffButton
            variant="primary"
            onClick={onResolveLegacyOrders}
            disabled={operationLocked || isRepairingLegacyOrders || !onResolveLegacyOrders}
          >
            {isRepairingLegacyOrders ? t('cashier.tables.legacy_repairing') : t('cashier.tables.resolve_legacy_orders')}
          </StaffButton>
        </div>
      )}
      {session.hasPendingPaymentHandoff && session.paymentHandoff && (
        <div className={styles.notice} role="status" aria-live="polite">
          <StatusBadge tone="warning">{t('cashier.tables.payment_requested')}</StatusBadge>
          <span>
            {t('server.bill.handoff_pending', {
              amount:
                formatTableMoney(session.paymentHandoff.requestedAmount, session) ??
                t('cashier.tables.currency_unknown'),
            })}
          </span>
        </div>
      )}
      {pendingOperation && (
        <div className={styles.notice} role="status" aria-live="polite">
          <span>{pendingCashierTableNoticeLabel(pendingOperation, t)}</span>
          {pendingOperation.status === 'Unknown' && (
            <StaffButton onClick={() => void onReconcilePendingOperation().catch(() => undefined)}>
              {t('cashier.tables.operation_retry')}
            </StaffButton>
          )}
          {pendingOperation.status === 'Unknown' && (
            <p className={styles.muted}>
              {pendingOperation.kind === 'payment'
                ? t('cashier.tables.reconciliation_unavailable')
                : t('cashier.tables.close_recheck_hint')}
            </p>
          )}
        </div>
      )}

      <CashierTableSessionActions
        session={session}
        legacyConflict={legacyConflict}
        writesLocked={writesLocked}
        onShowCloseConfirm={() => setShowCloseConfirm(true)}
        onShowReleaseConfirm={() => setShowReleaseConfirm(true)}
        onShowClearConfirm={() => setShowClearConfirm(true)}
      />
      {session.status === 'Open' && !session.isTableReleased && (
        <TableGuestAdmissionCodeSlot serviceSessionId={session.serviceSessionId} disabled={writesLocked} />
      )}

      <TableAccountPresentation
        session={session}
        timeZone={timeZone}
        fallback={<CashierTableSessionBill session={session} timeZone={timeZone} />}
      />
      <CashierTableSessionPaymentCollection
        session={session}
        locked={writesLocked}
        canCollect={actions.has('collect')}
        onUpdated={onRefresh}
        onSubmitPayment={onSubmitPayment}
      />

      <CashierTableSessionConfirmationModals
        session={session}
        tableDisplay={tableDisplay}
        isMutating={isMutating}
        showCloseConfirm={showCloseConfirm}
        showReleaseConfirm={showReleaseConfirm}
        showClearConfirm={showClearConfirm}
        onCloseConfirmChange={setShowCloseConfirm}
        onReleaseConfirmChange={setShowReleaseConfirm}
        onClearConfirmChange={setShowClearConfirm}
        onConfirmClose={() => void confirmClose()}
        onConfirmRelease={() => void confirmRelease()}
        onConfirmClear={() => void confirmClearAndRelease()}
      />
    </section>
  );
}
