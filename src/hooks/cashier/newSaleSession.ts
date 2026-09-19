import { getActiveTableServiceSessions } from '@/services/tableServiceSessionService';

/**
 * Resolve a dine-in counter sale to its OPEN table visit. The server validator refuses a
 * dine-in counter order without `serviceSessionId`, so the number the cashier typed has to
 * become a durable session id before anything is quoted — and a table with no open visit is
 * a decision for the Tables workspace, not an order the server should guess at.
 *
 * Returns the session id, or `null` when no open visit matches the number. Network failures
 * propagate: "cannot reach the server" and "this table has no visit" are different sentences.
 */
export async function resolveDineInSession(tableNumber: number): Promise<string | null> {
  const sessions = await getActiveTableServiceSessions();
  const match = sessions.find((session) => session.status === 'Open' && session.tableNumber === tableNumber);
  return match?.serviceSessionId ?? null;
}
