'use client';

import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import type { PendingTableOperation } from '@/lib/cashierTablePending';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import { tableSessionActions, formatTableMoney } from '@/lib/cashierTableSession';
import { sessionStatusLabel } from '@/lib/cashierTableLabels';
import CashierTableSessionBill from './CashierTableSessionBill';
import CashierTablePaymentForm from './CashierTablePaymentForm';
import styles from './CashierTableSession.module.css';

interface CashierTableSessionPanelProps {
  readonly session: TableServiceSessionDto;
  readonly timeZone?: string;
  readonly error: string | null;
  readonly isMutating: boolean;
  readonly isStale: boolean;
  readonly pendingOperation: PendingTableOperation | null;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly onSubmitPayment: (payment: AddTableServiceSessionPaymentRequest) => Promise<void>;
  readonly onCloseSession: () => Promise<void>;
  readonly onRetryPendingOperation: () => Promise<void>;
}

function displayError(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('cashier.') ? t(error) : error;
}

export default function CashierTableSessionPanel({
  session,
  timeZone,
  error,
  isMutating,
  isStale,
  pendingOperation,
  onBack,
  onRefresh,
  onSubmitPayment,
  onCloseSession,
  onRetryPendingOperation,
}: CashierTableSessionPanelProps) {
  const { t, i18n } = useTranslation();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const actions = tableSessionActions(session);
  const operationLocked = isMutating || pendingOperation !== null;
  const writesLocked = operationLocked || isStale;
  const closeAllowed = actions.has('close');
  const message = displayError(error, t);
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
          <button type="button" className={styles.button} onClick={onBack} disabled={operationLocked}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('cashier.tables.back')}
          </button>
          <p className={styles.eyebrow}>{t('cashier.tables.session')}</p>
          <h2 id="cashier-table-session-title" dir="auto">
            {t('cashier.tables.table_number', { table: session.tableNumber })}
          </h2>
          <p className={styles.muted}>{t('cashier.tables.opened', { time: opened })}</p>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge tone={session.status === 'Open' ? 'success' : 'neutral'}>
            {sessionStatusLabel(session.status, t)}
          </StatusBadge>
          <button type="button" className={styles.button} onClick={onRefresh} disabled={operationLocked}>
            <RefreshCw size={17} aria-hidden="true" />
            {t('cashier.workspace.refresh')}
          </button>
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
      {pendingOperation && (
        <div className={styles.notice} role="status" aria-live="polite">
          <span>
            {pendingOperation.status === 'Checking'
              ? t('cashier.tables.operation_checking')
              : pendingOperation.kind === 'payment'
                ? t('cashier.tables.payment_unknown')
                : t('cashier.tables.close_unknown')}
          </span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => void onRetryPendingOperation().catch(() => undefined)}
            disabled={pendingOperation.status === 'Checking'}
          >
            {pendingOperation.status === 'Checking'
              ? t('cashier.tables.operation_checking')
              : t('cashier.tables.operation_retry')}
          </button>
        </div>
      )}

      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={() => setShowCloseConfirm(true)}
          disabled={writesLocked || !closeAllowed}
          aria-describedby={!closeAllowed ? 'cashier-table-close-hint' : undefined}
        >
          {t('cashier.tables.close')}
        </button>
        {!closeAllowed && session.status === 'Open' && (
          <span id="cashier-table-close-hint" className={styles.muted}>
            {t('cashier.tables.close_not_ready')}
          </span>
        )}
      </div>

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
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setShowCloseConfirm(false)}
              disabled={isMutating}
            >
              {t('cashier.tables.cancel')}
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => void confirmClose()}
              disabled={isMutating}
            >
              {isMutating ? t('cashier.tables.operation_checking') : t('cashier.tables.close_confirm_action')}
            </button>
          </div>
        }
      >
        <p>{t('cashier.tables.close_confirm_message', { table: session.tableNumber })}</p>
        <p className={styles.muted}>{formatTableMoney(session.outstanding, session)}</p>
      </BaseModal>
    </section>
  );
}
