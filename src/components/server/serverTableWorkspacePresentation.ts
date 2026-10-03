import type { TFunction } from 'i18next';
import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type { ServerTableBlocker, ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';

export function statusTone(state: string): StatusBadgeTone {
  if (state === 'Ready') return 'success';
  if (state === 'Reserved') return 'warning';
  if (state === 'Ambiguous' || state === 'Inactive') return 'danger';
  if (state === 'Open') return 'info';
  return 'neutral';
}

export function blockerCopy(blocker: ServerTableBlocker, t: TFunction): string | null {
  switch (blocker) {
    case 'needs-reset':
      return t('server.floor.needs_reset');
    case 'reserved':
      return t('cashier.tables.reserved_table');
    case 'inactive':
      return t('cashier.tables.closed_table');
    case 'ambiguous':
      return t('cashier.tables.ambiguous');
    case 'legacy':
      return t('cashier.tables.legacy_table');
    case 'missing-session':
      return t('cashier.tables.no_session');
    case 'stale':
      return t('server.snapshot_stale');
    case 'unavailable':
      return t('cashier.tables.session_unavailable');
    default:
      return null;
  }
}

export function tableLabel(table: ServerTableSessionState['table'], tableId: string, t: TFunction): string {
  if (table?.tableLabel.trim()) return table.tableLabel;
  return t('cashier.tables.table_number', 'Table {{table}}', { table: tableId });
}
