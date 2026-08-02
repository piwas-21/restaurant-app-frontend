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
 * Payment status values
 */
/**
 * ⚠️ KNOWN to diverge from the backend, deliberately NOT changed here — see
 * BUGS-IMPROVEMENTS-PLAN E1. `PaymentStatus.cs` is
 * `Pending | Processing | Completed | Failed | Refunded | PartiallyRefunded | Overpaid | PartiallyPaid`,
 * i.e. it has no `Paid` and this union has no `Processing`/`PartiallyRefunded`/`Overpaid`.
 * `Overpaid` is already handled in `useOrderHelpers` and offered by the admin filter, so at least
 * one value outside this union reaches the UI today.
 *
 * Left alone because two different things are called a payment status — `order.paymentStatus` and
 * `payment.status` on a payment record (`RefundDialog` reads the latter) — and reconciling them
 * wrongly would misreport money. Needs a backend contract pass, not a guess.
 */
export type PaymentStatus = 'Pending' | 'Paid' | 'PartiallyPaid' | 'Refunded' | 'Failed';
