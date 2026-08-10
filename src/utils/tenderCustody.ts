import { OrderPaymentDto } from '@/types/order';

/**
 * Mirror of the backend's `TenderCustody` (`Features/Orders/Services/TenderCustody.cs`).
 *
 * A tender captured through a payment gateway is money sitting at that gateway, and neither this
 * app nor the tenant's backend can move it — the platform's Stripe key deliberately carries no
 * refunds write (SOFRA-PAYMENTS-PLAN §4). `RefundPaymentCommand` refuses those outright, so listing
 * one as refundable hands staff a button that always fails; the restaurant refunds it in its own
 * Stripe dashboard instead.
 *
 * Keyed on `paymentGateway` and not on `paymentMethod === 'OnlinePayment'` because the server's
 * rule is the gateway name, and the two are not the same set: a staff member can record an online
 * tender at the till for money that never went through a gateway, and that one IS refundable here.
 * A client rule looser or tighter than the server's only moves the refusal somewhere later.
 *
 * ⚠️ RELEASE ORDER: **this must not reach production ahead of the backend carrying `TenderCustody`.**
 * `paymentGateway` reaches this app through `OrderMappingService.MapToOrderPaymentDto`, which
 * dropped the field entirely until S11 — and that mapping and the server-side refusal ship in the
 * same backend change. So there is no "new frontend, old backend" state in which this fails safe:
 * against an older backend the field is absent, every tender reads as till-held, this offers the
 * Stripe capture AND the old handler books a refund against a charge still at Stripe, which is the
 * exact false ledger the slice exists to prevent. The frontend cannot detect that on its own; the
 * ordering is the guarantee. Backend first, then this.
 */
export function isHeldByGateway(payment: OrderPaymentDto): boolean {
  return Boolean(payment.paymentGateway?.trim());
}

/**
 * The gateways named across a set of tenders, for a notice that says where the refund is made.
 * De-duplicated, because two Stripe captures on one order are still one dashboard to visit.
 */
export function gatewayNames(payments: OrderPaymentDto[]): string[] {
  return Array.from(new Set(payments.filter(isHeldByGateway).map((p) => p.paymentGateway!.trim())));
}
