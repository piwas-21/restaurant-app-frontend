import { paymentStatusLabel } from './paymentStatus';

const echo = (key: string) => key;

/**
 * The money vocabulary. Two entities shared one backend enum and wrote DISJOINT subsets of it, and
 * the frontend collapsed both into one union containing a value — `'Paid'` — that the backend never
 * emits. See `types/order/enums.ts` for the three bugs that produced.
 */
describe('paymentStatusLabel', () => {
  it.each([
    // `Completed` is the backend's fully-paid value, and it keeps the "Paid" COPY — only the wire
    // value was ever wrong. It used to fall through to the raw enum name in all ten locales.
    ['Completed', 'payment_status_paid'],
    ['completed', 'payment_status_paid'],
    ['PartiallyPaid', 'payment_status_partially_paid'],
    ['partiallypaid', 'payment_status_partially_paid'],
    // Real, written twice by the API, and previously hand-special-cased in `useOrderHelpers`
    // because it could not be an entry in a map keyed by a union that omitted it.
    ['Overpaid', 'payment_status_overpaid'],
    ['Pending', 'payment_status_pending'],
    ['Refunded', 'payment_status_refunded'],
  ])('%s -> %s', (input, expected) => {
    expect(paymentStatusLabel(input, echo)).toBe(expected);
  });

  /**
   * The inverse, and the one that matters. Sending `'Paid'` as an admin filter made the server's
   * `Enum.TryParse` fail, which skipped the whole `Where` clause and returned EVERY order under a
   * label that said "Paid". Pinning that it does not resolve stops it being reintroduced as a
   * synonym for `Completed`.
   */
  it('does not resolve Paid — the backend has no such value', () => {
    expect(paymentStatusLabel('Paid', echo)).toBe('Paid');
  });

  it.each(['Processing', 'Failed', 'PartiallyRefunded'])(
    'does not resolve %s — in the enum, but never written by anything',
    (status) => {
      expect(paymentStatusLabel(status, echo)).toBe(status);
    },
  );

  it('returns an empty string for a missing payment status', () => {
    expect(paymentStatusLabel(null, echo)).toBe('');
    expect(paymentStatusLabel(undefined, echo)).toBe('');
  });
});
