import { gatewayNames, isHeldByGateway } from './tenderCustody';
import type { OrderPaymentDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';

const payment = (over: Partial<OrderPaymentDto>): OrderPaymentDto =>
  ({
    id: 'p',
    orderId: 'o',
    paymentMethod: PaymentMethod.Cash,
    amount: 1,
    status: 'Completed',
    ...over,
  }) as OrderPaymentDto;

/**
 * The client half of the backend's `TenderCustody`. Both halves must agree on the same set, or the
 * refusal simply moves from the dialog to the server response.
 */
describe('isHeldByGateway', () => {
  it('is true for a Stripe capture', () => {
    expect(isHeldByGateway(payment({ paymentGateway: 'Stripe' }))).toBe(true);
  });

  it('is false when the field is missing — every tender RUMI has ever taken', () => {
    expect(isHeldByGateway(payment({}))).toBe(false);
  });

  it('is false for blank and whitespace, which the free-text till field can produce', () => {
    // `AddPaymentToOrderCommand` copies this straight from the request body. Reading "   " as a
    // gateway would make a real till refund impossible with no way for staff to see why.
    expect(isHeldByGateway(payment({ paymentGateway: '' }))).toBe(false);
    expect(isHeldByGateway(payment({ paymentGateway: '  \t ' }))).toBe(false);
  });

  it('does NOT key off the payment method', () => {
    // The two sets are not the same. A staff member can record an online tender at the till for
    // money that never went through a gateway, and that one is refundable here — matching the
    // server, which asks the gateway column and not the method.
    expect(isHeldByGateway(payment({ paymentMethod: PaymentMethod.OnlinePayment }))).toBe(false);
    expect(isHeldByGateway(payment({ paymentMethod: PaymentMethod.Cash, paymentGateway: 'Stripe' }))).toBe(true);
  });
});

describe('gatewayNames', () => {
  it('de-duplicates — two Stripe captures are still one dashboard to visit', () => {
    expect(
      gatewayNames([payment({ paymentGateway: 'Stripe' }), payment({ paymentGateway: 'Stripe' }), payment({})]),
    ).toEqual(['Stripe']);
  });

  it('trims, so a padded value does not read as a second gateway', () => {
    expect(gatewayNames([payment({ paymentGateway: 'Stripe' }), payment({ paymentGateway: ' Stripe ' })])).toEqual([
      'Stripe',
    ]);
  });

  it('is empty when nothing is gateway-held, so the notice stays off', () => {
    expect(gatewayNames([payment({}), payment({ paymentGateway: '  ' })])).toEqual([]);
  });
});
