'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import type { PendingTableOperation } from '@/lib/cashierTablePending';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import {
  formatTableMoney,
  tableSessionActions,
  tableSessionCurrency,
  tableSessionEligibleOutstanding,
} from '@/lib/cashierTableSession';
import { CASHIER_NEW_SALE_PATH } from '@/lib/cashierWorkspace';
import { sessionStatusLabel, sessionTableDisplay } from '@/lib/cashierTableLabels';
import CashierTableSessionBill from './CashierTableSessionBill';
import CashierTablePaymentForm from './CashierTablePaymentForm';
import buttonStyles from '@/components/design-system/StaffButton.module.css';
import styles from './CashierTableSession.module.css';

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
  readonly onReconcilePendingOperation: () => Promise<void>;
}

function displayError(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('cashier.') ? t(error) : error;
}

function pendingNoticeLabel(operation: PendingTableOperation, t: (key: string) => string): string {
  if (operation.status === 'Checking') return t('cashier.tables.operation_checking');
  return operation.kind === 'payment' ? t('cashier.tables.payment_unknown') : t('cashier.tables.close_unknown');
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
  onReconcilePendingOperation,
}: CashierTableSessionPanelProps) {
  const { t, i18n } = useTranslation();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const tableDisplay = sessionTableDisplay(session, t);
  const actions = tableSessionActions(session);
  const operationLocked = isMutating || pendingOperation !== null;
  const writesLocked = operationLocked || isStale;
  const closeAllowed = actions.has('close');
  const legacyConflict = hasLegacyConflict || session.hasUnassignedActiveOrders === true;
  const addRoundAllowed = session.status === 'Open' && !writesLocked && !legacyConflict;
  const message = displayError(error, t);
  const currency = tableSessionCurrency(session);
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
            {sessionStatusLabel(session.status, t)}
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
          <span>{pendingNoticeLabel(pendingOperation, t)}</span>
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

      <div className={styles.actionRow}>
        <StaffButton
          variant="danger"
          onClick={() => setShowCloseConfirm(true)}
          disabled={writesLocked || !closeAllowed}
          aria-describedby={!closeAllowed ? 'cashier-table-close-hint' : undefined}
        >
          {t('cashier.tables.close')}
        </StaffButton>
        <StaffButton onClick={() => window.print()} disabled={writesLocked}>
          <Printer size={17} aria-hidden="true" />
          {t('cashier.tables.print_bill')}
        </StaffButton>
        {addRoundAllowed ? (
          // Add round goes to the workspace New sale composer with the table preselected
          // (pilot feedback), not the legacy waiter page. The review resolves the open visit
          // from the table number, so the session id does not need to travel.
          <Link
            className={`btn btn-secondary ${buttonStyles.touch}`}
            href={`${CASHIER_NEW_SALE_PATH}?channel=DineIn&table=${encodeURIComponent(String(session.tableNumber ?? ''))}`}
          >
            {t('cashier.tables.add_round')}
          </Link>
        ) : (
          <StaffButton disabled>{t('cashier.tables.add_round')}</StaffButton>
        )}
        {!closeAllowed && session.status === 'Open' && (
          <span id="cashier-table-close-hint" className={styles.muted}>
            {t('cashier.tables.close_not_ready')}
          </span>
        )}
      </div>
      {legacyConflict && <p className={styles.muted}>{t('cashier.tables.add_round_unavailable')}</p>}

      <CashierTableSessionBill session={session} timeZone={timeZone} />
      {actions.has('collect') && (
        <CashierTablePaymentForm session={session} disabled={writesLocked} onSubmit={onSubmitPayment} />
      )}

      <BaseModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        title={t('cashier.tables.close_confirm_title')}
        isPending={isMutating}
        footer={
          <div className={styles.formActions}>
            <StaffButton onClick={() => setShowCloseConfirm(false)} disabled={isMutating}>
              {t('cashier.tables.cancel')}
            </StaffButton>
            <StaffButton variant="danger" onClick={() => void confirmClose()} disabled={isMutating}>
              {isMutating ? t('cashier.tables.operation_checking') : t('cashier.tables.close_confirm_action')}
            </StaffButton>
          </div>
        }
      >
        <p>{t('cashier.tables.close_confirm_message', { table: tableDisplay })}</p>
        <p className={styles.muted}>
          {formatTableMoney(tableSessionEligibleOutstanding(session), session) ?? t('cashier.tables.currency_unknown')}
        </p>
        {!currency && <p className={styles.warning}>{t('cashier.tables.currency_unknown')}</p>}
      </BaseModal>
    </section>
  );
}
