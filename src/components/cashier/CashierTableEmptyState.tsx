'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { tableStatusLabel } from '@/lib/cashierTableLabels';
import styles from './CashierTableSession.module.css';

interface CashierTableEmptyStateProps {
  readonly entry: CashierTableEntry;
  readonly isOpening: boolean;
  readonly onBack: () => void;
  readonly onOpenSession: () => void;
}

export default function CashierTableEmptyState({
  entry,
  isOpening,
  onBack,
  onOpenSession,
}: CashierTableEmptyStateProps) {
  const { t } = useTranslation();
  const canOpen = entry.status === 'available';
  const message =
    entry.status === 'legacy'
      ? t('cashier.tables.legacy_table')
      : entry.status === 'reserved'
        ? t('cashier.tables.reserved_table')
        : canOpen
          ? t('cashier.tables.no_session')
          : t('cashier.tables.closed_table');
  return (
    <section className={styles.session} aria-labelledby="cashier-table-empty-title">
      <header className={styles.header}>
        <div className={styles.identity}>
          <button type="button" className={styles.button} onClick={onBack} disabled={isOpening}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('cashier.tables.back')}
          </button>
          <p className={styles.eyebrow}>{t('cashier.tables.table')}</p>
          <h2 id="cashier-table-empty-title" dir="auto">
            {t('cashier.tables.table_number', { table: entry.table.tableNumber })}
          </h2>
        </div>
        <StatusBadge tone={canOpen ? 'success' : 'neutral'}>{tableStatusLabel(entry.status, t)}</StatusBadge>
      </header>
      <p>{message}</p>
      {canOpen && (
        <button type="button" className={styles.primaryButton} onClick={onOpenSession} disabled={isOpening}>
          {isOpening ? t('cashier.tables.opening') : t('cashier.tables.open_session')}
        </button>
      )}
    </section>
  );
}
