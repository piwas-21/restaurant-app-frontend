import type { TFunction } from 'i18next';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';

export function serverTableRoundMessage(error: string | null, t: TFunction): string | null {
  if (!error) return null;
  return error.startsWith('server.round.') ? t(error, error) : error;
}

export function serverTableRoundBlocker(state: ServerTableSessionState, t: TFunction): string {
  switch (state.blocker) {
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
    default:
      return state.error ? t(state.error, state.error) : t('server.round.session_required');
  }
}
