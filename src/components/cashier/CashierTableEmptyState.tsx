'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { tableStatusLabel } from '@/lib/cashierTableLabels';
import TableOccupancyRecoveryAction from '@/components/table-service/TableOccupancyRecoveryAction';
import styles from './CashierTableSession.module.css';

interface CashierTableEmptyStateProps {
  readonly entry: CashierTableEntry;
  readonly isOpening: boolean;
  readonly onBack: () => void;
  readonly onOpenSession: () => void;
  readonly isRepairingLegacyOrders?: boolean;
  readonly onResolveLegacyOrders?: () => void;
  readonly recoveryEnabled?: boolean;
  readonly recoveryDisabled?: boolean;
  readonly recoveryOperationPending?: boolean;
  readonly onRecoveryComplete?: () => Promise<void>;
  readonly onRecoveryLockChange?: (locked: boolean) => void;
}

export default function CashierTableEmptyState({
  entry,
  isOpening,
  onBack,
  onOpenSession,
  isRepairingLegacyOrders = false,
  onResolveLegacyOrders,
  recoveryEnabled = false,
  recoveryDisabled = false,
  recoveryOperationPending = false,
  onRecoveryComplete,
  onRecoveryLockChange,
}: CashierTableEmptyStateProps) {
  const { t } = useTranslation();
  const canOpen = entry.status === 'available';
  const tableActionLocked = isOpening || isRepairingLegacyOrders || recoveryOperationPending;
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
          <StaffButton onClick={onBack} disabled={tableActionLocked}>
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
        <StaffButton variant="primary" onClick={onOpenSession} disabled={tableActionLocked}>
          {isOpening ? t('cashier.tables.opening') : t('cashier.tables.open_session')}
        </StaffButton>
      )}
      {(entry.status === 'legacy' || entry.status === 'conflict') && (
        <>
          <StaffButton
            variant="primary"
            onClick={onResolveLegacyOrders}
            disabled={tableActionLocked || !onResolveLegacyOrders}
          >
            {isRepairingLegacyOrders ? t('cashier.tables.legacy_repairing') : t('cashier.tables.resolve_legacy_orders')}
          </StaffButton>
        </>
      )}
      {onRecoveryComplete && entry.status !== 'available' && (
        <TableOccupancyRecoveryAction
          tableId={entry.table.id}
          enabled={recoveryEnabled}
          disabled={recoveryDisabled || isOpening || isRepairingLegacyOrders}
          onRecovered={onRecoveryComplete}
          onNavigationLockChange={onRecoveryLockChange}
        />
      )}
    </section>
  );
}
