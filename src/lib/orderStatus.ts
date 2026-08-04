import type { OrderStatus } from '@/types/order';
import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';

/**
 * The one place an order status turns into something a user sees.
 *
 * Before this, four modules each owned a slice of that job and two of them had already drifted:
 * `orderStatusStyles.getOrderStatusTranslationKey('InTransit')` returned `order_status_intransit`
 * while `useOrderHelpers.getStatusLabel('InTransit')` returned `order_status_in_transit`. Both keys
 * exist in all ten locale files — added so each divergent code path would resolve — and the same is
 * true of `payment_status_partiallypaid` beside `payment_status_partially_paid`. Duplicated
 * translations are the fossil record of duplicated logic.
 *
 * Ten more files carry their own `case 'Pending':` ladder. They are migrated separately; what this
 * module fixes first is that there is now something correct for them to migrate TO.
 *
 * ── Why a `Record`, not a function with a `default` ──────────────────────────────────────────
 * Both previous maps ended in a `default` that returned the raw enum value. `OrderStatus` has ten
 * members and `useOrderHelpers.getStatusLabel` handled eight, so `PendingApproval` and
 * `In Progress` fell through and rendered as **untranslated English** in every locale — silently,
 * because a `default` cannot fail. A total `Record<OrderStatus, …>` makes an unhandled member a
 * COMPILE error instead.
 */

export interface OrderStatusMeta {
  /** i18n key. One per status — the duplicate spellings are deleted with this module's arrival. */
  readonly i18nKey: string;
  /**
   * Modifier class in `styles/orderStatus.module.css`. Kept alongside the tone because the eight
   * `--badge-status-*` hues carry more information than five tones can: a cashier distinguishes
   * Preparing from Ready at a glance, and both would collapse to "warning".
   */
  readonly className:
    | 'statusPending'
    | 'statusConfirmed'
    | 'statusPreparing'
    | 'statusReady'
    | 'statusInTransit'
    | 'statusDelivered'
    | 'statusCompleted'
    | 'statusCancelled';
  /** Nearest `StatusBadge` tone, for surfaces that use the design-system primitive. */
  readonly tone: StatusBadgeTone;
}

export const ORDER_STATUS_META: Readonly<Record<OrderStatus, OrderStatusMeta>> = {
  Pending: { i18nKey: 'order_status_pending', className: 'statusPending', tone: 'warning' },
  // Distinct from Pending in the data and in the till, so it gets its own key rather than the
  // `default` that used to print "PendingApproval" at the user.
  PendingApproval: { i18nKey: 'order_status_pending_approval', className: 'statusPending', tone: 'warning' },
  Confirmed: { i18nKey: 'order_status_confirmed', className: 'statusConfirmed', tone: 'info' },
  Preparing: { i18nKey: 'order_status_preparing', className: 'statusPreparing', tone: 'info' },
  // A legacy value with a SPACE in it. It is in the union because the backend has emitted it, and
  // dropping it here would resurrect the raw-enum fallback for exactly one status.
  'In Progress': { i18nKey: 'order_status_in_progress', className: 'statusPreparing', tone: 'info' },
  Ready: { i18nKey: 'order_status_ready', className: 'statusReady', tone: 'success' },
  // The BACKEND's name for it (`OrderStatus.OutForDelivery`, serialised with `.ToString()`). It had
  // no entry anywhere in the frontend, so a delivery in transit printed its raw enum name in every
  // locale and wore the Pending colour. Shares copy and colour with `InTransit`, which is the same
  // concept under the name this app used to assume.
  OutForDelivery: { i18nKey: 'order_status_in_transit', className: 'statusInTransit', tone: 'info' },
  InTransit: { i18nKey: 'order_status_in_transit', className: 'statusInTransit', tone: 'info' },
  Delivered: { i18nKey: 'order_status_delivered', className: 'statusDelivered', tone: 'success' },
  Completed: { i18nKey: 'order_status_completed', className: 'statusCompleted', tone: 'success' },
  Cancelled: { i18nKey: 'order_status_cancelled', className: 'statusCancelled', tone: 'danger' },
  // Also missing until now. A comment in `constants/orderStatus.ts` asserted "Refunded is a
  // PaymentStatus, not an OrderStatus" — it is BOTH (`OrderStatus.cs:13`), which is how a refunded
  // order came to belong to neither the Active nor the Past tab.
  Refunded: { i18nKey: 'order_status_refunded', className: 'statusCancelled', tone: 'danger' },
};

/**
 * Which statuses a staff surface may offer NEXT, mirroring the backend's `IsValidStatusTransition`
 * (`UpdateOrderStatusCommand.cs`) — the only authority on what the server will accept.
 *
 * The cashier dialog carried its own `switch` over this, and it disagreed with the server in SIX of
 * its twelve states. Two of them stranded an order outright, because the ladder's `default` returned an
 * empty list and an empty list is indistinguishable from "this order is finished":
 *
 * | status            | the cashier offered      | the server accepts               |
 * |-------------------|--------------------------|----------------------------------|
 * | `Pending`         | Confirmed, Cancelled     | + `PendingApproval`              |
 * | `PendingApproval` | **nothing**              | Confirmed, Cancelled             |
 * | `Ready`           | Completed, Cancelled     | + `OutForDelivery`               |
 * | `OutForDelivery`  | **nothing**              | Completed, Cancelled             |
 * | `InTransit`       | Delivered, Cancelled     | **nothing** — not a server status |
 * | `Delivered`       | Completed, Cancelled     | **nothing**                      |
 *
 * The two that mattered most: a DELIVERY could never be dispatched, because `Ready` did not offer
 * `OutForDelivery`; and once the server put an order into `OutForDelivery` — which is the name it
 * actually emits — the cashier had no way to move it again.
 *
 * `InTransit` is this app's own historical spelling and is not a server status at all, so it leads
 * nowhere: anything offered there was rejected on submit. It stays in the union because the server
 * has emitted it (see `ORDER_STATUS_META`), but it is a dead end by definition, not by omission.
 *
 * ⚠️ `Delivered` is empty because the SERVER has no rule for it — it falls to `_ => false`, so every
 * transition out of a delivered order is refused. That looks like a backend gap rather than a
 * deliberate terminal state, but inventing a rule here would only move the rejection from the
 * server to a place nobody is looking. Flagged for a backend pass, not guessed at.
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  Pending: ['Confirmed', 'PendingApproval', 'Cancelled'],
  PendingApproval: ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['OutForDelivery', 'Completed', 'Cancelled'],
  OutForDelivery: ['Completed', 'Cancelled'],
  InTransit: [],
  // Same as `InTransit`: this app's own historical spelling, never a server status, so it leads
  // nowhere. TypeScript required this entry, which is the point of the Record.
  'In Progress': [],
  Delivered: [],
  Completed: [],
  Cancelled: [],
  Refunded: [],
};

/**
 * The next statuses a staff surface should offer for `status`, or `[]` when there are none.
 *
 * An unknown status also yields `[]` — the same answer as a terminal one, and deliberately so: a
 * value this build does not recognise is not one it can reason about, and offering a guess would
 * put the rejection at the server after the user has committed to it.
 */
export function nextOrderStatuses(status: string | null | undefined): readonly OrderStatus[] {
  const resolved = resolveOrderStatus(status);
  return resolved ? ORDER_STATUS_TRANSITIONS[resolved] : [];
}

/**
 * Look a status up from a plain `string`.
 *
 * The callers hold `string`, not `OrderStatus` — the value arrives over HTTP, so the type is a
 * claim rather than a guarantee. Matching is case-insensitive and ignores spaces because the four
 * previous ladders each normalised differently (`'in transit'`, `'intransit'`, `'InTransit'` all
 * appear in the code being replaced), and a status the server sends in an unexpected casing must
 * not silently fall back to "Pending".
 */
const BY_NORMALISED: ReadonlyMap<string, OrderStatus> = new Map(
  (Object.keys(ORDER_STATUS_META) as OrderStatus[]).map((s) => [s.toLowerCase().replace(/\s+/g, ''), s]),
);

export function resolveOrderStatus(status: string | null | undefined): OrderStatus | null {
  if (!status) return null;
  return BY_NORMALISED.get(status.toLowerCase().replace(/\s+/g, '')) ?? null;
}

/** Meta for a status, or `null` when the server sent something this build does not know. */
export function orderStatusMeta(status: string | null | undefined): OrderStatusMeta | null {
  const resolved = resolveOrderStatus(status);
  return resolved ? ORDER_STATUS_META[resolved] : null;
}

/**
 * Translated label. An unknown status returns the RAW value rather than a guess — showing the
 * server's own word is honest, and the previous behaviour of defaulting to "Pending" could tell a
 * cashier an order was waiting when it had been cancelled.
 */
export function orderStatusLabel(status: string | null | undefined, t: (key: string) => string): string {
  const meta = orderStatusMeta(status);
  return meta ? t(meta.i18nKey) : (status ?? '');
}
