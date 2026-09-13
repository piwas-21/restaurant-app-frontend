import type { CashierTableStatus } from '@/hooks/cashier/useCashierTables';
import type { TableServiceSessionStatus } from '@/types/order';

type Translate = (key: string) => string;

export function tableStatusLabel(status: CashierTableStatus, t: Translate): string {
  if (status === 'occupied') return t('cashier.tables.status_occupied');
  if (status === 'closed') return t('cashier.tables.status_closed');
  if (status === 'legacy') return t('cashier.tables.status_legacy');
  if (status === 'reserved') return t('cashier.tables.status_reserved');
  return t('cashier.tables.status_available');
}

export function sessionStatusLabel(status: TableServiceSessionStatus | string, t: Translate): string {
  return status === 'Closed' ? t('cashier.tables.status_closed') : t('cashier.tables.status_open');
}
