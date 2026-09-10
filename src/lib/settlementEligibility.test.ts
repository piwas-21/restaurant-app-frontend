import { canCollectPayment } from './settlementEligibility';
import type { OrderDto } from '@/types/order';

const order = (over: Record<string, unknown>): OrderDto =>
  ({
    status: 'Completed',
    paymentStatus: 'Pending',
    total: 42,
    remainingAmount: 42,
    totalPaid: 0,
    payments: [],
    ...over,
  }) as unknown as OrderDto;

describe('canCollectPayment — the till mirror of backend OrderSettlementEligibility (#522)', () => {
  it('collects a completed-but-unpaid sale', () => {
    expect(canCollectPayment(order({}))).toBe(true);
  });

  it('refuses cancelled and refunded orders', () => {
    expect(canCollectPayment(order({ status: 'Cancelled' }))).toBe(false);
    expect(canCollectPayment(order({ status: 'Refunded' }))).toBe(false);
    expect(canCollectPayment(order({ paymentStatus: 'Refunded' }))).toBe(false);
  });

  it('refuses an order whose only tender was refunded', () => {
    expect(
      canCollectPayment(order({ payments: [{ id: 'p1', status: 'Refunded', isRefunded: true, refundedAmount: 42 }] })),
    ).toBe(false);
  });

  it('refuses credit and settled orders', () => {
    expect(canCollectPayment(order({ remainingAmount: 0 }))).toBe(false);
    expect(canCollectPayment(order({ remainingAmount: -5 }))).toBe(false);
  });
});
