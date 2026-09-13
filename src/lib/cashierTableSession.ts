import type { TableServiceSessionDto } from '@/types/order';
import { formatCurrency, TENANT_CURRENCY, TENANT_LOCALE } from '@/utils/currency';

const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;

export type TableSessionAction = 'collect' | 'close';

/** Table service sessions use an integer key; normalise display values such as `01` at the seam. */
export function tableNumberKey(value: string | number): string {
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, '') : text;
}

/** The DTO is the server's decision surface; this helper never infers a visit from table number. */
export function tableSessionActions(session: TableServiceSessionDto): ReadonlySet<TableSessionAction> {
  if (session.status !== 'Open' || session.bill.isAmbiguous) return new Set<TableSessionAction>();
  const actions = new Set<TableSessionAction>();
  if (session.outstanding > 0) actions.add('collect');
  const allRoundsTerminal = session.bill.orders.every(
    (order) => order.status === 'Completed' || order.status === 'Cancelled',
  );
  if (session.outstanding <= 0 && allRoundsTerminal) actions.add('close');
  return actions;
}

export function tableSessionCurrency(session: Pick<TableServiceSessionDto, 'currency' | 'bill'>): string {
  // New sessions carry the captured currency on their metadata. Older/read-repaired
  // payloads may only expose it on the bill or one of its member orders, so walk all
  // server-owned sources before using the configured tenant default.
  const candidates = [session.currency, session.bill.currency, ...session.bill.orders.map((order) => order.currency)];
  const captured = candidates.find((value) => {
    const candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return ISO_CURRENCY_CODE.test(candidate);
  });
  return typeof captured === 'string' ? captured.trim().toUpperCase() : TENANT_CURRENCY;
}

/** Format table money with the session's captured currency, never the viewer's language. */
export function formatTableMoney(
  amount: number | null | undefined,
  session: Pick<TableServiceSessionDto, 'currency' | 'bill'>,
): string {
  return formatCurrency(amount ?? 0, TENANT_LOCALE, tableSessionCurrency(session));
}

export function tableSessionIsTerminal(session: TableServiceSessionDto): boolean {
  return session.status === 'Closed';
}
