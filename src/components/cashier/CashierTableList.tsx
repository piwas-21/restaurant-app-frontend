'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { formatCashierDateTime } from '@/lib/cashierDateTime';
import { formatTableMoney, tableNumberKey, tableSessionEligibleOutstanding } from '@/lib/cashierTableSession';
import { sessionTableDisplay, tableStatusLabel } from '@/lib/cashierTableLabels';
import styles from './CashierTableList.module.css';

type BadgeTone = 'success' | 'warning' | 'neutral';

function tone(status: CashierTableEntry['status']): BadgeTone {
  if (status === 'occupied' || status === 'legacy' || status === 'reserved' || status === 'conflict') return 'warning';
  if (status === 'available') return 'success';
  return 'neutral';
}

interface CashierTableListProps {
  readonly entries: readonly CashierTableEntry[];
  readonly selectedTableNumber: string | null;
  readonly timeZone?: string;
  readonly onSelectTable: (tableNumber: string, serviceSessionId?: string) => void;
  readonly disabled?: boolean;
}

export default function CashierTableList({
  entries,
  selectedTableNumber,
  timeZone,
  onSelectTable,
  disabled = false,
}: CashierTableListProps) {
  const { t, i18n } = useTranslation();
  if (entries.length === 0) return <p className={styles.empty}>{t('cashier.tables.no_tables')}</p>;

  return (
    <ul className={styles.list} aria-label={t('cashier.tables.list_label')}>
      {entries.map((entry) => {
        const { table, session, status } = entry;
        const number = table.tableNumber;
        const displayName = session
          ? sessionTableDisplay(session, t)
          : t('cashier.tables.table_number', { table: number });
        const selected = selectedTableNumber !== null && tableNumberKey(selectedTableNumber) === tableNumberKey(number);
        const accessibleLabel = session?.hasPendingPaymentHandoff
          ? `${t('cashier.tables.select_table', { table: displayName })}, ${t('cashier.tables.payment_requested')}`
          : t('cashier.tables.select_table', { table: displayName });
        const balance = session
          ? (formatTableMoney(tableSessionEligibleOutstanding(session), session) ??
            t('cashier.tables.currency_unknown'))
          : t('cashier.tables.no_balance');
        const opened = session
          ? formatCashierDateTime(
              session.openedAt,
              i18n.language || 'en',
              timeZone,
              'short',
              t('cashier.tables.unknown_time'),
            )
          : null;
        return (
          <li key={table.id} className={styles.item}>
            <button
              type="button"
              className={styles.card}
              aria-pressed={selected}
              aria-label={accessibleLabel}
              onClick={() => onSelectTable(number, session?.serviceSessionId)}
              disabled={disabled}
            >
              <span className={styles.header}>
                <span className={styles.number} dir="auto">
                  {displayName}
                </span>
                <StatusBadge tone={tone(status)}>{tableStatusLabel(status, t)}</StatusBadge>
              </span>
              <span className={styles.meta}>
                <span>{t('cashier.tables.capacity', { count: table.maxGuests })}</span>
                {session && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>{t('cashier.tables.rounds', { count: session.roundCount })}</span>
                  </>
                )}
                {(status === 'legacy' || status === 'conflict') && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {t('cashier.tables.legacy_orders', {
                        count: session?.legacyActiveOrderCount ?? table.activeOrderCount ?? 0,
                      })}
                    </span>
                  </>
                )}
              </span>
              {session && (
                <span className={styles.meta}>
                  <span>{t('cashier.tables.opened', { time: opened })}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{t('cashier.tables.age', { minutes: session.ageMinutes })}</span>
                </span>
              )}
              {session?.hasPendingPaymentHandoff && (
                <span className={styles.meta}>
                  <StatusBadge tone="warning">{t('cashier.tables.payment_requested')}</StatusBadge>
                </span>
              )}
              <span className={styles.balance}>
                <span>{t('cashier.tables.outstanding')}</span>
                <strong>{balance}</strong>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
