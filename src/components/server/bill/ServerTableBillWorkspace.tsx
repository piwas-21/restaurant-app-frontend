'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BillPrintButton from '@/components/order/BillPrintButton';
import BaseModal from '@/components/design-system/BaseModal';
import OperationResultNotice from '@/components/design-system/OperationResultNotice';
import StaffButton from '@/components/design-system/StaffButton';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import TableServiceSessionBill from '@/components/table-service/TableServiceSessionBill';
import TableAccountPresentation from '@/components/table-service/TableAccountPresentation';
import { formatTableMoney } from '@/lib/cashierTableSession';
import { useServerTableBillActions } from '@/hooks/serverWorkspace/useServerTableBillActions';
import { useServerAccountCollectionCapability } from '@/hooks/serverWorkspace/useServerAccountCollectionCapability';
import type { TableServiceSessionDto } from '@/types/order';
import ServerAccountPaymentCollectionHost from './ServerAccountPaymentCollectionHost';
import FreeTableConfirmationModal from '@/components/table-service/FreeTableConfirmationModal';
import styles from './ServerTableBillWorkspace.module.css';

interface ServerTableBillWorkspaceProps {
  readonly session: TableServiceSessionDto;
  readonly actionsBlocked: boolean;
  readonly refreshWorkspace: () => Promise<void>;
}

function safeError(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('server.') || error.startsWith('cashier.') || error.startsWith('staff_table_reuse.')
    ? t(error)
    : error;
}

export default function ServerTableBillWorkspace({
  session: initialSession,
  actionsBlocked,
  refreshWorkspace,
}: Readonly<ServerTableBillWorkspaceProps>) {
  const { t } = useTranslation();
  const router = useTenantLocaleRouter();
  const actions = useServerTableBillActions(initialSession, refreshWorkspace);
  const session = actions.session ?? initialSession;
  const canStartCollection = useServerAccountCollectionCapability(session);
  const [showRelease, setShowRelease] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [releaseError, setReleaseError] = useState(false);
  const [printNotice, setPrintNotice] = useState(false);
  const writesLocked = actionsBlocked || actions.isStale || actions.isMutating;
  const error = safeError(actions.error, t);
  const collectionParams = new URLSearchParams({ serviceSessionId: session.serviceSessionId });
  if (session.tableId) collectionParams.set('tableId', session.tableId);

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

      {releaseError && !showRelease && !error && <p role="alert">{t('cashier.tables.release_failed')}</p>}
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

      <FreeTableConfirmationModal
        session={session}
        isOpen={showRelease}
        isPending={actions.isMutating}
        error={releaseError ? (error ?? t('cashier.tables.release_failed')) : null}
        onClose={() => setShowRelease(false)}
        onConfirm={() => {
          setReleaseError(false);
          void actions
            .releaseTable()
            .then(() => {
              setReleaseError(false);
              setShowRelease(false);
            })
            .catch(() => setReleaseError(true));
        }}
      />
      <div className={styles.actions}>
        {session.status === 'Open' && !session.isTableReleased && (
          <StaffButton
            variant="secondary"
            onClick={() => {
              setReleaseError(false);
              setShowRelease(true);
            }}
            disabled={writesLocked || !session.canReleaseTable}
          >
            {t('cashier.tables.release_table')}
          </StaffButton>
        )}
        <StaffButton onClick={() => void actions.refresh().catch(() => undefined)} disabled={actions.isMutating}>
          <RefreshCw size={17} aria-hidden="true" />
          {t('refresh')}
        </StaffButton>
        {canStartCollection && (
          <StaffButton
            variant="primary"
            onClick={() => router.push(`/server/collection?${collectionParams.toString()}`)}
            disabled={writesLocked}
          >
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
        <BillPrintButton
          label={t('cashier.tables.print_bill')}
          disabled={writesLocked}
          target={{ serviceSessionId: session.serviceSessionId, expectedVersion: session.version }}
          onBrowserPrint={() => {
            window.print();
            setPrintNotice(true);
          }}
        />
        {session.isTableReleased && session.canClose && (
          <StaffButton variant="secondary" onClick={() => setShowClose(true)} disabled={writesLocked}>
            {t('server.bill.close_visit')}
          </StaffButton>
        )}
      </div>

      <ServerAccountPaymentCollectionHost
        session={session}
        disabled={writesLocked}
        recoveryEnabled={!writesLocked && session.status === 'Open'}
        canStartCollection={canStartCollection}
        expanded={false}
        onUpdated={() => void actions.refresh().catch(() => undefined)}
      />

      <TableAccountPresentation session={session} fallback={<TableServiceSessionBill session={session} />} />

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
