import { OrderType, type CreateOrderItemDto } from '@/types/order';
import { buildCounterSaleRequest, defaultChannelFor, parseTableNumber } from './newSaleRequest';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';

describe('defaultChannelFor', () => {
  it('prefers takeaway for a walk-up counter sale', () => {
    expect(defaultChannelFor([OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery])).toBe(OrderType.Takeaway);
  });

  it('falls back to the first enabled channel when takeaway is disabled', () => {
    expect(defaultChannelFor([OrderType.Delivery])).toBe(OrderType.Delivery);
  });

  it('degrades to takeaway when nothing is enabled yet', () => {
    expect(defaultChannelFor([])).toBe(OrderType.Takeaway);
  });
});

describe('parseTableNumber', () => {
  it.each([
    ['12', 12],
    [' 12 ', 12],
  ])('parses %s', (raw, parsed) => {
    expect(parseTableNumber(raw)).toBe(parsed);
  });

  it.each(['', 'abc', '0', '-3', '2.5'])('refuses %s', (raw) => {
    expect(parseTableNumber(raw)).toBeNull();
  });
});

describe('buildCounterSaleRequest — the wire contract', () => {
  const line: CashierNewSaleDraftLine = {
    product: { id: 'product-1', name: 'Burger' },
    quantity: 2,
    variationId: 'large',
    variationName: 'Large',
    notes: 'Large | Add: Bacon',
    unitPrice: 24,
    selectedIngredientIds: ['bacon'],
    ingredientQuantities: { bacon: 1 },
    sideItems: [{ id: 'coke', name: 'Coke', quantity: 2, price: 2.5 }],
  };

  it('builds the same item shape the waiter path posts (parity with catalog buildOrderItems)', () => {
    const request = buildCounterSaleRequest({ channel: OrderType.Takeaway, lines: [line], notes: 'urgent' });

    expect(request.items).toHaveLength(1);
    const item = request.items[0] as CreateOrderItemDto;
    expect(item).toEqual({
      productId: 'product-1',
      productVariationId: 'large',
      quantity: 2,
      unitPrice: 24,
      specialInstructions: 'Large | Add: Bacon',
      selectedIngredientIds: ['bacon'],
      ingredientQuantities: { bacon: 1 },
      childItems: [{ productId: 'coke', quantity: 2, unitPrice: 2.5, kind: 'SideItem' }],
    });
  });

  it('keeps takeaway free of table fields and always declares an unpaid state', () => {
    const request = buildCounterSaleRequest({
      channel: OrderType.Takeaway,
      lines: [line],
      notes: '',
      tableNumber: 12,
      serviceSessionId: 'session-1',
    });
    expect(request.tableNumber).toBeUndefined();
    expect(request.serviceSessionId).toBeUndefined();
    expect(request.paymentState).toBe('Unpaid');
    expect(request.notes).toBeUndefined();
  });

  it('carries the table and its resolved open session for dine-in only', () => {
    const dineIn = buildCounterSaleRequest({
      channel: OrderType.DineIn,
      lines: [line],
      notes: '',
      tableNumber: 12,
      serviceSessionId: 'session-1',
    });
    expect(dineIn.tableNumber).toBe(12);
    expect(dineIn.serviceSessionId).toBe('session-1');

    const delivery = buildCounterSaleRequest({
      channel: OrderType.Delivery,
      lines: [line],
      notes: '',
      tableNumber: 12,
      serviceSessionId: 'session-1',
    });
    expect(delivery.tableNumber).toBeUndefined();
    expect(delivery.serviceSessionId).toBeUndefined();
  });
});
