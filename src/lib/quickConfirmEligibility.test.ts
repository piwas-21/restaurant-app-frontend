import { OrderDto, OrderType } from '@/types/order';
import { isQuickConfirmCandidate } from './quickConfirmEligibility';

const order = (overrides: Partial<OrderDto>): OrderDto =>
  ({
    id: 'order-1',
    orderNumber: '1042',
    status: 'Pending',
    type: OrderType.DineIn,
    tableNumber: null,
    ...overrides,
  }) as OrderDto;

describe('isQuickConfirmCandidate', () => {
  it.each([OrderType.Takeaway, OrderType.Delivery])('keeps pending %s in the staff decision queue', (type) => {
    expect(isQuickConfirmCandidate(order({ type }))).toBe(true);
  });

  it('adds tableless dine-in to the staff decision queue', () => {
    expect(isQuickConfirmCandidate(order({ type: OrderType.DineIn, tableNumber: null }))).toBe(true);
  });

  it('keeps table-based dine-in out of the quick-confirm queue', () => {
    expect(isQuickConfirmCandidate(order({ type: OrderType.DineIn, tableNumber: 12 }))).toBe(false);
  });

  it('never offers quick confirmation after the pending state', () => {
    expect(isQuickConfirmCandidate(order({ status: 'Confirmed', type: OrderType.Takeaway }))).toBe(false);
  });
});
