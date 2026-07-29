import { OrderType } from '@/types/order';
import type { DeliveryAddress } from '@/contexts/CheckoutContext';

/**
 * localStorage persistence for the order-type choice: the TTL, the malformed-payload defences, and
 * the expiry signal §9.17's server disarm keys off.
 *
 * Extracted from `OrderTypeContext` to keep that file inside its 250-LOC budget. It is pure — no
 * React, no network — which is also what lets the TTL rules be reasoned about on their own.
 */
export interface OrderTypeState {
  orderType: OrderType | null;
  table: string;
  deliveryAddress: DeliveryAddress | null;
  /**
   * When the order type was chosen, epoch ms. Drives the TTL below; `null` on a state with no
   * choice, and on a payload written before this field existed (which then expires immediately —
   * deliberate, since we cannot tell a five-minute-old choice from a month-old one).
   */
  chosenAt: number | null;
}

export const STORAGE_KEY = 'rumi_order_type_state';

/**
 * How long a persisted order type stays valid. It is in localStorage, so it survives the browser
 * being closed: without this, a Delivery chosen last month silently filters the menu on the next
 * visit and prefills a stale address. Past the window the choice is dropped and the guest is back
 * in the no-type browse state, which is the app's normal starting point anyway.
 */
export const ORDER_TYPE_TTL_MS = 24 * 60 * 60 * 1000;

export const initialState: OrderTypeState = {
  orderType: null,
  table: '',
  deliveryAddress: null,
  chosenAt: null,
};

const VALID_ORDER_TYPES: ReadonlySet<OrderType> = new Set([OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery]);

/**
 * What hydration produced, and whether a stored channel was DROPPED on the way.
 *
 * `expired` exists because the two outcomes are indistinguishable from the state alone — both give
 * `orderType: null` — and only one of them means the SERVER basket is now armed on a channel the
 * guest no longer holds. §9.17's disarm has to fire for the expiry and not for the never-chose,
 * which is exactly the distinction that was missing when the TTL path was believed to run through
 * `clearOrderType`. It does not: this function returns `initialState` directly.
 */
export interface LoadedState {
  state: OrderTypeState;
  expired: boolean;
}

/**
 * The persisted `orderType` field, or `null` when it is absent or not a known enum value.
 *
 * Defends against stale/malformed payloads (older app versions, hand-edited devtools, half-written
 * writes from a crash). A `null` orderType means "unset"; anything unrecognised also resolves to
 * null rather than gaslighting the welcome modal into thinking the guest has already chosen.
 */
function parseOrderType(value: unknown): OrderType | null {
  if (value === null || value === undefined) return null;
  return VALID_ORDER_TYPES.has(value as OrderType) ? (value as OrderType) : null;
}

export function loadState(): LoadedState {
  const fresh = (state: OrderTypeState): LoadedState => ({ state, expired: false });
  if (typeof window === 'undefined') return fresh(initialState);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh(initialState);
    const parsed = JSON.parse(raw) as Partial<OrderTypeState> & { orderType?: unknown; chosenAt?: unknown };
    const orderType = parseOrderType(parsed.orderType);
    const chosenAt = typeof parsed.chosenAt === 'number' ? parsed.chosenAt : null;
    // Expire the whole choice, not just the type: the table number and delivery address are
    // companions of it, and keeping either around would leave an orphan the UI would still read.
    if (orderType !== null && (chosenAt === null || Date.now() - chosenAt > ORDER_TYPE_TTL_MS)) {
      // `expired`, not a plain initialState: a channel WAS held and has just been dropped, so the
      // server basket may still be armed on it (§9.17). The caller disarms on this flag.
      return { state: initialState, expired: true };
    }

    return fresh({
      orderType,
      table: typeof parsed.table === 'string' ? parsed.table : '',
      deliveryAddress: parsed.deliveryAddress ?? null,
      chosenAt,
    });
  } catch (err) {
    console.error('Failed to load order-type state:', err);
    return fresh(initialState);
  }
}

export function saveState(state: OrderTypeState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save order-type state:', err);
  }
}
