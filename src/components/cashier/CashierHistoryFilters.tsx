'use client';

import { useTranslation } from 'react-i18next';
import type {
  CashierHistoryFilters as HistoryFilters,
  CashierHistoryRange,
} from '@/hooks/cashier/useCashierHistoryFilters';
import styles from './CashierWorkspaceQueue.module.css';

interface CashierHistoryFiltersProps {
  readonly filters: Pick<
    HistoryFilters,
    | 'range'
    | 'fromDay'
    | 'toDay'
    | 'tenantDayLoading'
    | 'tenantDayError'
    | 'tenantDayErrorMessage'
    | 'setRange'
    | 'setFromDay'
    | 'setToDay'
    | 'refreshTenantDay'
  >;
}

const RANGES: readonly CashierHistoryRange[] = ['today', 'yesterday', 'week', 'custom'];

function rangeLabel(range: CashierHistoryRange, t: (key: string) => string): string {
  switch (range) {
    case 'today':
      return t('cashier.workspace.range_today');
    case 'yesterday':
      return t('cashier.workspace.range_yesterday');
    case 'week':
      return t('cashier.workspace.range_week');
    case 'custom':
      return t('cashier.workspace.range_custom');
  }
}

export default function CashierHistoryFilters({ filters }: CashierHistoryFiltersProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.historyFilters}>
      <label className={styles.filterField}>
        <span>{t('cashier.workspace.history_range')}</span>
        <select
          className={styles.filterSelect}
          value={filters.range}
          onChange={(event) => filters.setRange(event.target.value as CashierHistoryRange)}
        >
          {RANGES.map((range) => (
            <option key={range} value={range}>
              {rangeLabel(range, t)}
            </option>
          ))}
        </select>
      </label>
      {filters.range === 'custom' && (
        <div className={styles.historyDateFields}>
          <label className={styles.filterField}>
            <span>{t('cashier.workspace.from')}</span>
            <input
              className={styles.filterSelect}
              type="date"
              value={filters.fromDay}
              onChange={(event) => filters.setFromDay(event.target.value)}
            />
          </label>
          <label className={styles.filterField}>
            <span>{t('cashier.workspace.to')}</span>
            <input
              className={styles.filterSelect}
              type="date"
              value={filters.toDay}
              onChange={(event) => filters.setToDay(event.target.value)}
            />
          </label>
        </div>
      )}
      {filters.tenantDayLoading && filters.range !== 'custom' && (
        <output className={styles.historyDayStatus}>{t('cashier.workspace.tenant_day_loading')}</output>
      )}
      {filters.tenantDayError && filters.range !== 'custom' && (
        <div className={styles.historyDayError} role="alert">
          <span>{filters.tenantDayErrorMessage || t('cashier.workspace.tenant_day_unavailable')}</span>
          <button type="button" className={styles.stateAction} onClick={filters.refreshTenantDay}>
            {t('cashier.workspace.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
