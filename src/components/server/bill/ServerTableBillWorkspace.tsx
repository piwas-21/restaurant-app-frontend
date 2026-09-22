'use client';

import { useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import OperationResultNotice from '@/components/design-system/OperationResultNotice';
import StaffButton from '@/components/design-system/StaffButton';
import CashierTablePaymentForm from '@/components/cashier/CashierTablePaymentForm';
import TableServiceSessionBill from '@/components/table-service/TableServiceSessionBill';
import { formatTableMoney } from '@/lib/cashierTableSession';
import { useServerTableBillActions } from '@/hooks/serverWorkspace/useServerTableBillActions';
import type { TableServiceSessionDto } from '@/types/order';
import styles from './ServerTableBillWorkspace.module.css';

interface ServerTableBillWorkspaceProps {
  readonly session: TableServiceSessionDto;
  readonly actionsBlocked: boolean;
  readonly refreshWorkspace: () => Promise<void>;
}

function safeError(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('server.') || error.startsWith('cashier.') ? t(error) : error;
}

function closeBlocker(session: TableServiceSessionDto, t: (key: string) => string): string | null {
  if (session.hasPendingPaymentHandoff) return t('server.bill.close_blocked_handoff');
  if (session.hasUnassignedActiveOrders || session.bill.isAmbiguous) return t('server.bill.close_blocked_legacy');
  if (session.bill.remaining > 0) return t('server.bill.close_blocked_balance');
  if (!session.canClose && session.status === 'Open') return t('server.bill.close_blocked_rounds');
  return null;
}

export default function ServerTableBillWorkspace({
  session: initialSession,
  actionsBlocked,
  refreshWorkspace,
}: Readonly<ServerTableBillWorkspaceProps>) {
  const { t } = useTranslation();
  const actions = useServerTableBillActions(initialSession, refreshWorkspace);
  const session = actions.session ?? initialSession;
  const [showPayment, setShowPayment] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [printNotice, setPrintNotice] = useState(false);
  const writesLocked = actionsBlocked || actions.isStale || actions.isMutating;
  const blocker = closeBlocker(session, t);
  const error = safeError(actions.error, t);

  const confirmClose = async () => {
    try {
      await actions.closeSession();
      setShowClose(false);
    } catch (_error) {
      // The hook refreshes authoritative state and owns the visible failure.
    }
  };

  return (
    <section className={styles.workspace} aria-labelledby="server-table-bill-actions">
      <h2 id="server-table-bill-actions" className={styles.title}>
        {t('server.bill.title')}
      </h2>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {session.hasPendingPaymentHandoff && session.paymentHandoff && (
        <OperationResultNotice
          state="committed"
          operationId={session.paymentHandoff.operationId}
          message={t('server.bill.handoff_pending', {
            amount:
              formatTableMoney(session.paymentHandoff.requestedAmount, session) ?? t('cashier.tables.currency_unknown'),
          })}
        />
      )}
      {printNotice && <OperationResultNotice state="saved" message={t('server.bill.print_dialog_opened')} />}

      <div className={styles.actions}>
        <StaffButton onClick={() => void actions.refresh().catch(() => undefined)} disabled={actions.isMutating}>
          <RefreshCw size={17} aria-hidden="true" />
          {t('refresh')}
        </StaffButton>
        {session.canCollect && (
          <StaffButton variant="primary" onClick={() => setShowPayment((visible) => !visible)} disabled={writesLocked}>
            {t('server.bill.collect')}
          </StaffButton>
        )}
        {session.canRequestPaymentHandoff && (
          <StaffButton
            variant="primary"
            onClick={() => void actions.requestHandoff().catch(() => undefined)}
            disabled={writesLocked}
          >
            {t('server.bill.send_to_cashier')}
          </StaffButton>
        )}
        {session.hasPendingPaymentHandoff && (
          <StaffButton onClick={() => void actions.cancelHandoff().catch(() => undefined)} disabled={writesLocked}>
            {t('server.bill.cancel_handoff')}
          </StaffButton>
        )}
        <StaffButton
          onClick={() => {
            window.print();
            setPrintNotice(true);
          }}
          disabled={writesLocked}
        >
          <Printer size={17} aria-hidden="true" />
          {t('cashier.tables.print_bill')}
        </StaffButton>
        <StaffButton
          variant="danger"
          onClick={() => setShowClose(true)}
          disabled={writesLocked || !session.canClose}
          aria-describedby={blocker ? 'server-table-close-blocker' : undefined}
        >
          {t('server.bill.close_visit')}
        </StaffButton>
      </div>

      {blocker && (
        <p id="server-table-close-blocker" className={styles.blocker}>
          {blocker}
        </p>
      )}

      {showPayment && session.canCollect && (
        <CashierTablePaymentForm
          session={session}
          disabled={writesLocked}
          onSubmit={async (payment) => {
            await actions.submitPayment(payment);
            setShowPayment(false);
          }}
        />
      )}

      <TableServiceSessionBill session={session} />

      <BaseModal
        isOpen={showClose}
        onClose={() => setShowClose(false)}
        title={t('server.bill.close_confirm_title')}
        isPending={actions.isMutating}
        footer={
          <div className={styles.modalActions}>
            <StaffButton onClick={() => setShowClose(false)} disabled={actions.isMutating}>
              {t('cashier.tables.cancel')}
            </StaffButton>
            <StaffButton variant="danger" onClick={() => void confirmClose()} disabled={actions.isMutating}>
              {t('server.bill.close_visit')}
            </StaffButton>
          </div>
        }
      >
        <p>{t('server.bill.close_confirm_message', { table: session.tableLabel || session.tableNumber })}</p>
      </BaseModal>
    </section>
  );
}
