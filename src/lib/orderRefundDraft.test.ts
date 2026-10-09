import { PaymentMethod } from '@/types/order';
import type { OrderDto } from '@/types/order';
import { buildOrderRefundDraft } from './orderRefundDraft';

const order = {
  id: 'order-1',
  currency: 'CHF',
  payments: [
    {
      id: 'payment-1',
      amount: 40,
      paymentMethod: PaymentMethod.Cash,
      tipMinor: 325,
      refundedTipMinor: 100,
      status: 'Completed',
    },
  ],
} as unknown as OrderDto;

describe('buildOrderRefundDraft', () => {
  it('keeps order debt refund and remaining staff-tip refund as separate amounts', () => {
    const result = buildOrderRefundDraft({
      order,
      paymentId: 'payment-1',
      amount: '40.00',
      tipAmount: '2.25',
      reason: 'Customer request',
    });

    expect(result).toEqual({
      ok: true,
      paymentId: 'payment-1',
      command: { refundAmount: 40, refundTipMinor: 225, refundReason: 'Customer request' },
    });
  });

  it('rejects refunds above the remaining collected tip', () => {
    const result = buildOrderRefundDraft({
      order,
      paymentId: 'payment-1',
      amount: '0.00',
      tipAmount: '2.26',
      reason: 'Customer request',
    });

    expect(result).toEqual({
      ok: false,
      errorKey: 'cashier.refund_tip_exceeds_payment',
      max: expect.stringContaining('2.25'),
    });
  });
});
