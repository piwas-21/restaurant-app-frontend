'use client';

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FloorPlanScene from '@/components/floor-plan/FloorPlanScene';
import { useFloorPlanDocument } from '@/hooks/floorPlan/useFloorPlanDocument';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';
import type { TableRenderState } from '@/components/floor-plan/sceneTypes';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { formatTableMoney, tableNumberKey } from '@/lib/cashierTableSession';
import { tableStatusLabel } from '@/lib/cashierTableLabels';
import styles from './CashierTableMap.module.css';

interface CashierTableMapProps {
  readonly entries: readonly CashierTableEntry[];
  readonly selectedTableNumber: string | null;
  readonly onSelectTable: (tableNumber: string, serviceSessionId?: string) => void;
  readonly disabled?: boolean;
}

function mapState(entry: CashierTableEntry, selected: boolean): TableRenderState {
  if (selected) return 'selected';
  if (entry.status === 'closed') return 'dim';
  if (entry.session || entry.status === 'legacy' || entry.status === 'reserved') return 'occupied';
  return 'available';
}

export default function CashierTableMap({
  entries,
  selectedTableNumber,
  onSelectTable,
  disabled = false,
}: CashierTableMapProps) {
  const { t } = useTranslation();
  const { document, status, retry } = useFloorPlanDocument();
  const entryByNumber = useMemo(
    () => new Map(entries.map((entry) => [tableNumberKey(entry.table.tableNumber), entry])),
    [entries],
  );
  const activePlan = useMemo(
    () => (document ? { ...document, tables: document.tables.filter((table) => table.isActive) } : null),
    [document],
  );
  const states = useMemo(() => {
    const next: Record<string, TableRenderState> = {};
    activePlan?.tables.forEach((table) => {
      const entry = entryByNumber.get(tableNumberKey(table.tableNumber));
      if (entry)
        next[table.id] = mapState(
          entry,
          tableNumberKey(selectedTableNumber ?? '') === tableNumberKey(table.tableNumber),
        );
    });
    return next;
  }, [activePlan, entryByNumber, selectedTableNumber]);
  const selectGeometry = useCallback(
    (id: string) => {
      const geometry = activePlan?.tables.find((table) => table.id === id);
      if (!geometry) return;
      const entry = entryByNumber.get(tableNumberKey(geometry.tableNumber));
      if (entry) onSelectTable(entry.table.tableNumber, entry.session?.serviceSessionId);
    },
    [activePlan, entryByNumber, onSelectTable],
  );
  const formatLabel = useCallback(
    (table: FloorPlanTableGeometry, state: TableRenderState) => {
      const entry = entryByNumber.get(tableNumberKey(table.tableNumber));
      const status = entry ? tableStatusLabel(entry.status, t) : t('cashier.tables.status_available');
      const balance = entry?.session
        ? formatTableMoney(entry.session.outstanding, entry.session)
        : t('cashier.tables.no_balance');
      return t('cashier.tables.map_label', {
        table: table.tableNumber,
        seats: table.maxGuests,
        status,
        amount: balance,
        state,
      });
    },
    [entryByNumber, t],
  );

  if (status === 'loading') return <div className={styles.message}>{t('cashier.tables.map_loading')}</div>;
  if (status === 'error' || !activePlan) {
    return (
      <div className={styles.message} role="alert">
        <span>{t('cashier.tables.map_error')}</span>
        <button type="button" className={styles.retry} onClick={retry}>
          {t('cashier.tables.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.map} aria-label={t('cashier.tables.map_label_region')}>
      <FloorPlanScene
        document={activePlan}
        tableStates={states}
        onSelectTable={disabled ? undefined : selectGeometry}
        formatTableLabel={formatLabel}
        role="application"
        ariaLabel={t('cashier.tables.map_label_region')}
      />
    </div>
  );
}
