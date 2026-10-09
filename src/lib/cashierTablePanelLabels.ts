import type { PendingTableOperation } from './cashierTablePending';

export function displayCashierTableError(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('cashier.') ? t(error) : error;
}

export function pendingCashierTableNoticeLabel(operation: PendingTableOperation, t: (key: string) => string): string {
  if (operation.status === 'Checking') return t('cashier.tables.operation_checking');
  return operation.kind === 'payment' ? t('cashier.tables.payment_unknown') : t('cashier.tables.close_unknown');
}
