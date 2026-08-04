/**
 * Order enums and status unions. Extracted from types/order.ts
 * (Sprint 4/6 type-file split by domain).
 */

/**
 * Order type enum
 */
export enum OrderType {
  DineIn = 'DineIn',
  Takeaway = 'Takeaway',
  Delivery = 'Delivery',
}

/**
 * Payment method enum
 */
export enum PaymentMethod {
  Cash = 'Cash',
  CreditCard = 'CreditCard',
  DebitCard = 'DebitCard',
  OnlinePayment = 'OnlinePayment',
  MobilePayment = 'MobilePayment',
  BankTransfer = 'BankTransfer',
}

/**
 * Order status values
 */
/**
 * Mirrors `RestaurantSystem.Domain/Common/Enums/OrderStatus.cs`, which the API serialises with
 * `.ToString()` — so these are the C# member names, verbatim.
 *
 * `OutForDelivery` and `Refunded` were MISSING until 2026-08-02, and both are reachable: the
 * backend's own transition table allows `Ready → OutForDelivery → Completed|Cancelled`. With no
 * frontend entry, a delivery order in transit rendered its raw enum name untranslated in all ten
 * locales, wore the *Pending* badge colour, and belonged to neither the Active nor the Past tab on
 * `/orders` — it simply vanished from both.
 *
 * `InTransit` and `'In Progress'` are NOT backend values. They are kept because stored/legacy rows
 * and older clients still carry them, and dropping them would resurrect the raw-enum fallback for
 * exactly those. `InTransit` was previously used *as* the name for OutForDelivery, which is why the
 * real one was never handled.
 */
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'OutForDelivery'
  | 'InTransit'
  | 'In Progress'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'Refunded'
  | 'PendingApproval';

/**
 * Payment status — TWO types, because the backend has two things wearing one enum.
 *
 * `PaymentStatus.cs` has eight members, but `Order.PaymentStatus` and `OrderPayment.Status` write
 * DISJOINT subsets of them, and three members are never written by anything. Verified by reading
 * every write site in the API:
 *
 * | written by                       | values |
 * |----------------------------------|--------|
 * | `Order.PaymentStatus`            | `Pending` `PartiallyPaid` `Completed` `Overpaid` `Refunded` |
 * | `OrderPayment.Status`            | `Pending` `Completed` `PartiallyRefunded` `Refunded` |
 * | *nothing*                        | `Processing` `Failed` |
 *
 * One shared union is what let three bugs ship, all of them from a value the backend never emits:
 *
 * 1. **`'Paid'` does not exist in the backend.** The fully-paid value is `Completed`. The admin
 *    orders filter sent `paymentStatus: 'Paid'` to the server, where `Enum.TryParse` FAILED and the
 *    whole `Where` clause was skipped — so "Paid" returned **every order**, unfiltered. An empty
 *    list would have been noticed; a full one looks plausible.
 * 2. The cashier's filter compares client-side, so the same value returned **zero** orders there.
 * 3. `RefundDialog` filtered payments on `status === 'Paid'`, which a payment record can never be —
 *    the refundable list was **always empty**.
 *
 * Keeping them separate is the point: a filter over ORDERS must not accept a value only a payment
 * RECORD can hold, and vice versa.
 */

/** What `Order.PaymentStatus` can be — the order's overall payment state. */
export type OrderPaymentStatus = 'Pending' | 'PartiallyPaid' | 'Completed' | 'Overpaid' | 'Refunded';

/**
 * What `OrderPayment.Status` can be — ONE payment record. Narrower than the order's, but not by as
 * much as it first looks; enumerate the writers rather than assuming:
 *
 * - `Pending` — every record is CREATED pending (`OrderPaymentBuilder:35`,
 *   `AddPaymentToOrderCommand:91`), and **a cash payment stays that way** until it is explicitly
 *   completed. Cash is the common case in a restaurant, so this is not an edge state.
 * - `Completed` — non-cash auto-completes on create (`OrderPaymentBuilder:53`); cash on
 *   `AddPaymentToOrderCommand:110`.
 * - `PartiallyRefunded` — a PARTIAL refund
 *   (`RefundPaymentCommand:72`: `RefundAmount == Amount ? Refunded : PartiallyRefunded`).
 * - `Refunded` — a full refund, and `CancelOrderCommand:92`.
 *
 * ⚠️ `PartiallyPaid` is deliberately NOT here, and that is the whole distinction this file exists
 * for. It is an ORDER-level word — "some tenders in, balance outstanding" — and a single tender is
 * either taken or not. The backend used to store it on a partial refund while the Z-report looked
 * for `PartiallyRefunded`, which nothing wrote, so partially-refunded payments fell out of the
 * end-of-day money report entirely. Fixed backend-side in #286; this union moved with it, and a
 * comparison against `'PartiallyPaid'` on a payment record is now a compile error again.
 */
export type PaymentRecordStatus = 'Pending' | 'Completed' | 'PartiallyRefunded' | 'Refunded';
