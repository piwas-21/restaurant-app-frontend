import type { OrderDto, TableServiceSessionDto } from '@/types/order';
import { formatCurrency, TENANT_LOCALE } from '@/utils/currency';

const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;
const PAYMENT_TOLERANCE = 0.01;

export type TableSessionAction = 'collect' | 'close';
export type TableOrderSettlementState = 'eligible' | 'settled' | 'credit' | 'refunded' | 'cancelled';

/** Table service sessions use an integer key; normalise display values such as `01` at the seam. */
export function tableNumberKey(value: string | number): string {
  const text = String(value).trim();
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, '') : text;
}

/**
 * Keep refund/credit semantics visible instead of treating every non-positive balance as paid.
 * The backend remains authoritative; this is only the presentation/action guard until the table
 * bill contract carries an explicit settlement state.
 */
export function tableOrderSettlementState(
  order: Pick<OrderDto, 'status' | 'paymentStatus' | 'remainingAmount' | 'payments'>,
): TableOrderSettlementState {
  const hasRefund =
    order.status === 'Refunded' ||
    order.paymentStatus === 'Refunded' ||
    order.payments.some(
      (payment) =>
        payment.status === 'Refunded' ||
        payment.status === 'PartiallyRefunded' ||
        payment.isRefunded === true ||
        (payment.refundedAmount ?? 0) > 0,
    );
  if (hasRefund) return 'refunded';
  if (order.status === 'Cancelled') return 'cancelled';
  if (order.paymentStatus === 'Overpaid' || order.remainingAmount < -PAYMENT_TOLERANCE) return 'credit';
  if (order.remainingAmount > PAYMENT_TOLERANCE) return 'eligible';
  return 'settled';
}

export type TableSessionMoney = Pick<TableServiceSessionDto, 'bill' | 'outstanding' | 'eligibleOutstanding'>;

/** Server-owned collectible debt, with a compatibility fallback for pre-follow-up payloads. */
export function tableSessionEligibleOutstanding(session: TableSessionMoney): number {
  const value = session.eligibleOutstanding ?? session.bill.eligibleOutstanding ?? session.outstanding;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Server-owned overpayment credit, when the settlement-aware bill contract is available. */
export function tableSessionCredit(session: Pick<TableServiceSessionDto, 'bill'>): number {
  const value = session.bill.credit ?? 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function fallbackCanCollect(session: TableServiceSessionDto): boolean {
  const hasBlockingRefund = session.bill.orders.some(
    (order) => tableOrderSettlementState(order) === 'refunded' && order.remainingAmount > PAYMENT_TOLERANCE,
  );
  return tableSessionEligibleOutstanding(session) > PAYMENT_TOLERANCE && !hasBlockingRefund;
}

function fallbackCanClose(session: TableServiceSessionDto): boolean {
  const allRoundsTerminal = session.bill.orders.every(
    (order) => order.status === 'Completed' || order.status === 'Cancelled' || order.status === 'Refunded',
  );
  return tableSessionEligibleOutstanding(session) <= PAYMENT_TOLERANCE && allRoundsTerminal;
}

/** The DTO is the server's decision surface; this helper never infers a visit from table number. */
export function tableSessionActions(session: TableServiceSessionDto): ReadonlySet<TableSessionAction> {
  if (session.status !== 'Open' || session.bill.isAmbiguous) return new Set<TableSessionAction>();
  const actions = new Set<TableSessionAction>();
  const canCollect = session.canCollect ?? fallbackCanCollect(session);
  const canClose = session.canClose ?? fallbackCanClose(session);
  if (canCollect) actions.add('collect');
  if (canClose) actions.add('close');
  return actions;
}

export function tableSessionCurrency(session: Pick<TableServiceSessionDto, 'currency' | 'bill'>): string | null {
  // Currency is server-owned. A missing value is an unknown-money state, not permission to use the
  // build-time tenant default for a historical or malformed session.
  const candidates = [session.currency, session.bill.currency, ...session.bill.orders.map((order) => order.currency)];
  const captured = candidates.find((value) => {
    const candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return ISO_CURRENCY_CODE.test(candidate);
  });
  return typeof captured === 'string' ? captured.trim().toUpperCase() : null;
}

/** Format table money with the session's captured currency, never the viewer's language. */
export function formatTableMoney(
  amount: number | null | undefined,
  session: Pick<TableServiceSessionDto, 'currency' | 'bill'>,
): string | null {
  const currency = tableSessionCurrency(session);
  return currency ? formatCurrency(amount ?? 0, TENANT_LOCALE, currency) : null;
}

export function tableSessionIsTerminal(session: TableServiceSessionDto): boolean {
  return session.status === 'Closed';
}
