import { getActiveTableServiceSessions } from '@/services/tableServiceSessionService';
import type { TableServiceSessionDto } from '@/types/order';
import { parseTableNumber } from './newSaleRequest';

export interface DineInTarget {
  tableId?: string;
  tableNumber?: number;
  serviceSessionId: string;
}

interface TableSelection {
  label: string;
  tableId?: string;
  serviceSessionId?: string;
}

/** Recheck the selected visit before quoting, including identities carried by an Add round link. */
export async function resolveDineInSession(selection: TableSelection): Promise<DineInTarget | null> {
  const label = selection.label.trim();
  if (!label) return null;
  const number = parseTableNumber(label);
  const sessions = await getActiveTableServiceSessions();
  const matches = sessions.filter((session) => {
    if (session.status !== 'Open' || !session.serviceSessionId) return false;
    if (selection.tableId || selection.serviceSessionId) {
      const sessionLabel =
        session.tableLabel?.trim() || (session.tableNumber != null ? String(session.tableNumber) : '');
      return (
        session.tableId === selection.tableId &&
        session.serviceSessionId === selection.serviceSessionId &&
        sessionLabel.toLocaleLowerCase() === label.toLocaleLowerCase()
      );
    }
    return number !== null
      ? session.tableNumber === number
      : session.tableLabel?.toLocaleLowerCase() === label.toLocaleLowerCase();
  });
  if (matches.length === 0) return null;
  // A label alone cannot choose between two different physical tables.
  if (new Set(matches.map((session) => session.tableId ?? session.tableNumber)).size > 1) return null;
  const match: TableServiceSessionDto = matches.reduce(
    (left, right) => (right.openedAt > left.openedAt ? right : left),
    matches[0],
  );
  return {
    ...(match.tableId ? { tableId: match.tableId } : {}),
    ...(match.tableNumber !== null ? { tableNumber: match.tableNumber } : {}),
    serviceSessionId: match.serviceSessionId,
  };
}
