import type { CashierTableStatus } from '@/hooks/cashier/useCashierTables';
import type { TableServiceSessionDto } from '@/types/order';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One display name per visit: the server-configured label wins, then the table number, and a
 * label-only visit stays visible instead of rendering "Table null" (backend TableNumber is nullable).
 */
export function sessionTableDisplay(
  session: Pick<TableServiceSessionDto, 'tableNumber' | 'tableLabel'>,
  t: Translate,
): string {
  const label = session.tableLabel?.trim();
  if (label) return label;
  if (session.tableNumber !== null && session.tableNumber !== undefined) {
    return t('cashier.tables.table_number', { table: session.tableNumber });
  }
  return t('cashier.tables.unnamed_table');
}

export function tableStatusLabel(status: CashierTableStatus, t: Translate): string {
  if (status === 'occupied') return t('cashier.tables.status_occupied');
  if (status === 'closed') return t('cashier.tables.status_closed');
  if (status === 'legacy') return t('cashier.tables.status_legacy');
  if (status === 'reserved') return t('cashier.tables.status_reserved');
  if (status === 'conflict') return t('cashier.tables.status_conflict');
  return t('cashier.tables.status_available');
}

export function sessionStatusLabel(status: string, t: Translate): string {
  return status === 'Closed' ? t('cashier.tables.status_closed') : t('cashier.tables.status_open');
}
