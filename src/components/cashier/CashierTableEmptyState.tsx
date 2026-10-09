'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge from '@/components/design-system/StatusBadge';
import BaseModal from '@/components/design-system/BaseModal';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { tableStatusLabel } from '@/lib/cashierTableLabels';
import styles from './CashierTableSession.module.css';

interface CashierTableEmptyStateProps {
  readonly entry: CashierTableEntry;
  readonly isOpening: boolean;
  readonly onBack: () => void;
  readonly onOpenSession: () => void;
  readonly isRepairingLegacyOrders?: boolean;
  readonly onResolveLegacyOrders?: () => void;
  readonly onClearLegacyOrders?: () => Promise<void>;
}

export default function CashierTableEmptyState({
  entry,
  isOpening,
  onBack,
  onOpenSession,
  isRepairingLegacyOrders = false,
  onResolveLegacyOrders,
  onClearLegacyOrders,
}: CashierTableEmptyStateProps) {
  const { t } = useTranslation();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const canOpen = entry.status === 'available';
  let message = t('cashier.tables.closed_table');
  if (entry.status === 'needs-reset') message = t('server.floor.needs_reset');
  if (entry.status === 'legacy' || entry.status === 'conflict') {
    message = t('cashier.tables.legacy_table');
  } else if (entry.status === 'reserved') {
    message = t('cashier.tables.reserved_table');
  } else if (canOpen) {
    message = t('cashier.tables.no_session');
  }
  return (
    <section className={styles.session} aria-labelledby="cashier-table-empty-title">
      <header className={styles.header}>
        <div className={styles.identity}>
          <StaffButton onClick={onBack} disabled={isOpening}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('cashier.tables.back')}
          </StaffButton>
          <p className={styles.eyebrow}>{t('cashier.tables.table')}</p>
          <h2 id="cashier-table-empty-title" dir="auto">
            {t('cashier.tables.table_number', { table: entry.table.tableNumber })}
          </h2>
        </div>
        <StatusBadge tone={canOpen ? 'success' : 'neutral'}>{tableStatusLabel(entry.status, t)}</StatusBadge>
      </header>
      <p>{message}</p>
      {canOpen && (
        <StaffButton variant="primary" onClick={onOpenSession} disabled={isOpening}>
          {isOpening ? t('cashier.tables.opening') : t('cashier.tables.open_session')}
        </StaffButton>
      )}
      {(entry.status === 'legacy' || entry.status === 'conflict') && (
        <>
          <StaffButton
            variant="primary"
            onClick={onResolveLegacyOrders}
            disabled={isOpening || isRepairingLegacyOrders || !onResolveLegacyOrders}
          >
            {isRepairingLegacyOrders ? t('cashier.tables.legacy_repairing') : t('cashier.tables.resolve_legacy_orders')}
          </StaffButton>
          {entry.status === 'legacy' && (
            <StaffButton
              variant="danger"
              onClick={() => setShowClearConfirm(true)}
              disabled={isOpening || isRepairingLegacyOrders || !onClearLegacyOrders}
            >
              {t('cashier.tables.clear_and_release')}
            </StaffButton>
          )}
        </>
      )}
      <BaseModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title={t('cashier.tables.clear_confirm_title')}
        isPending={isOpening || isRepairingLegacyOrders}
        footer={
          <div className={styles.formActions}>
            <StaffButton onClick={() => setShowClearConfirm(false)} disabled={isOpening || isRepairingLegacyOrders}>
              {t('cashier.tables.cancel')}
            </StaffButton>
            <StaffButton
              variant="danger"
              onClick={() =>
                void onClearLegacyOrders?.()
                  .then(() => setShowClearConfirm(false))
                  .catch(() => undefined)
              }
              disabled={isOpening || isRepairingLegacyOrders || !onClearLegacyOrders}
            >
              {isOpening || isRepairingLegacyOrders
                ? t('cashier.tables.operation_checking')
                : t('cashier.tables.clear_and_release')}
            </StaffButton>
          </div>
        }
      >
        <p>{t('cashier.tables.clear_confirm_message', { table: entry.table.tableNumber })}</p>
        <p className={styles.warning}>{t('cashier.tables.clear_confirm_limits')}</p>
      </BaseModal>
    </section>
  );
}
