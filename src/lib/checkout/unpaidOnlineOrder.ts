/**
 * The one order that exists on the server but has not been paid at Stripe yet
 * (SOFRA-PAYMENTS-PLAN §5 S8).
 *
 * **Why this is not just a `useRef`.** A ref lives exactly as long as the document, and the single
 * most likely second press of Place Order comes AFTER a document load: the diner goes to Stripe,
 * abandons or pays, and presses Back. The cart is deliberately still intact for exactly that
 * journey, so with an in-memory ref the next press creates a second order — and in the
 * already-paid case, a second CHARGE, because a fresh order passes the backend's
 * `EnsurePayable` check that the first one would now fail.
 *
 * `sessionStorage`, not `localStorage`: this must die with the tab. A remembered order id
 * outliving the browsing session would attach a stale, long-cancelled order to someone's next
 * visit.
 *
 * The full fix for the paid-then-Back journey is S9's return trip, which settles the payment and
 * clears the cart. This narrows it in the meantime — the diner meets the backend's honest
 * "already been partly or fully paid" refusal instead of a second Stripe page.
 */

const STORAGE_KEY = 'sofra.checkout.unpaidOnlineOrder';

export interface UnpaidOnlineOrder {
  orderId: string;
  /**
   * A fingerprint of the order command the order was created from.
   *
   * Re-using an order whose command has since changed would charge the diner the OLD total: the
   * amount comes from the persisted `order.Total` (server-authoritative, S0b), so a tip or a
   * points redemption added after a failed attempt would show on screen and never reach Stripe.
   */
  signature: string;
}

export function fingerprintOrderCommand(command: unknown): string {
  // Deterministic: `buildOrderCommand` constructs the same keys in the same order every time and
  // includes no clock or random value, so equal inputs give an equal string. Checked rather than
  // assumed, because a spurious MISmatch is the expensive direction — it creates a duplicate order.
  return JSON.stringify(command);
}

export function readUnpaidOnlineOrder(): UnpaidOnlineOrder | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { orderId, signature } = parsed as Partial<UnpaidOnlineOrder>;
    return typeof orderId === 'string' && typeof signature === 'string' ? { orderId, signature } : null;
  } catch (error) {
    // Storage denied (private mode, blocked cookies) or a corrupt value. Deliberately not
    // surfaced to the diner: forgetting the order is the SAFE direction of this function — they
    // get a fresh order rather than a wrong one, which is the pre-S8 behaviour. `warn` rather
    // than `debug` because the repo's no-console rule permits only `warn`/`error`, and this is
    // rare enough (private browsing, blocked storage) not to be noise.
    console.warn('Could not read the remembered unpaid order; treating as none.', error);
    return null;
  }
}

export function rememberUnpaidOnlineOrder(order: UnpaidOnlineOrder): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (error) {
    console.warn('Could not remember the unpaid order; a retry may create a second one.', error);
  }
}

export function forgetUnpaidOnlineOrder(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not forget the unpaid order.', error);
  }
}
