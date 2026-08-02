import type { OrderPaymentStatus } from '@/types/order';

/**
 * Payment status — the money half, split out of `orderStatus.ts`.
 *
 * Not only for the 200-LOC limit: an ORDER's payment state and a PAYMENT RECORD's are two different
 * things that shared one backend enum, and treating them as one is what shipped three bugs (the
 * evidence is on the types in `types/order/enums.ts`). Keeping the money vocabulary in its own
 * module puts that boundary in the import list, where it is hard to miss.
 *
 * This module is about the ORDER's status. A payment RECORD's four values are a different set —
 * `PaymentRecordStatus` — and deliberately have no label map here, because nothing renders a bare
 * record status through this path today.
 */

/**
 * Keyed by `OrderPaymentStatus`, so a value the backend can emit but this map forgets is a COMPILE
 * error. The map it replaces was keyed by a union containing `'Paid'` — which the backend never
 * emits — and missing `Completed` and `Overpaid`, which it does. Those two fell through to the raw
 * enum name in all ten locales, and `useOrderHelpers` had grown a hand-written special case for
 * `Overpaid` that this makes unnecessary.
 *
 * `Completed` keeps the `payment_status_paid` copy and the `paymentPaid` class: "Paid" is the right
 * WORD for a guest and a cashier, and it is already translated in all ten locales. Only the wire
 * value was ever wrong.
 */
export const PAYMENT_STATUS_META: Readonly<Record<OrderPaymentStatus, { i18nKey: string; className: string }>> = {
  Pending: { i18nKey: 'payment_status_pending', className: 'paymentPending' },
  PartiallyPaid: { i18nKey: 'payment_status_partially_paid', className: 'paymentPartiallyPaid' },
  Completed: { i18nKey: 'payment_status_paid', className: 'paymentPaid' },
  // Its OWN class, not PartiallyPaid's: overpaid and underpaid are opposite money conditions and
  // shared one orange badge, which made them indistinguishable at a glance on a till.
  Overpaid: { i18nKey: 'payment_status_overpaid', className: 'paymentOverpaid' },
  Refunded: { i18nKey: 'payment_status_refunded', className: 'paymentRefunded' },
};

/**
 * The order payment statuses a filter may offer, in display order.
 *
 * Exported so the cashier and admin filters render from ONE list instead of two hand-written
 * `<option>` sets. Both had drifted from the backend, in different directions: each offered `Paid`,
 * which the backend never emits, and admin also offered `Failed`, which nothing ever writes. A
 * hardcoded `<option value="…">` is a wire value with no type on it, which is exactly how a filter
 * comes to name a state the system cannot be in.
 */
export const ORDER_PAYMENT_STATUSES: readonly OrderPaymentStatus[] = [
  'Pending',
  'PartiallyPaid',
  'Completed',
  'Overpaid',
  'Refunded',
];

const PAYMENT_BY_NORMALISED: ReadonlyMap<string, OrderPaymentStatus> = new Map(
  (Object.keys(PAYMENT_STATUS_META) as OrderPaymentStatus[]).map((s) => [s.toLowerCase().replace(/\s+/g, ''), s]),
);

export function paymentStatusLabel(status: string | null | undefined, t: (key: string) => string): string {
  if (!status) return '';
  const resolved = PAYMENT_BY_NORMALISED.get(status.toLowerCase().replace(/\s+/g, ''));
  return resolved ? t(PAYMENT_STATUS_META[resolved].i18nKey) : status;
}
