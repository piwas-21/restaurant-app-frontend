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

describe('buildCounterSaleRequest — customer and delivery contact', () => {
  const line: CashierNewSaleDraftLine = { product: { id: 'p1', name: 'Burger' }, quantity: 1, unitPrice: 10 };

  const address = {
    addressLine1: 'Musterstrasse 1',
    addressLine2: 'Top 2',
    city: 'Genève',
    postalCode: '1201',
    country: 'CH',
    deliveryInstructions: 'Ring twice',
  };

  it('carries the customer fields and, on delivery, the address', () => {
    const request = buildCounterSaleRequest({
      channel: OrderType.Delivery,
      lines: [line],
      notes: '',
      contact: { customerName: 'Ada', customerPhone: '+4122000000', deliveryAddress: address },
    });

    expect(request.customerName).toBe('Ada');
    expect(request.customerPhone).toBe('+4122000000');
    expect(request.deliveryAddress).toEqual(address);
    expect(request.tableNumber).toBeUndefined();
    expect(request.serviceSessionId).toBeUndefined();
  });

  it('never carries a delivery address on takeaway or dine-in', () => {
    for (const channel of [OrderType.Takeaway, OrderType.DineIn]) {
      const request = buildCounterSaleRequest({
        channel,
        lines: [line],
        notes: '',
        contact: { customerName: 'Ada', deliveryAddress: address },
      });
      expect(request.deliveryAddress).toBeUndefined();
      expect(request.customerName).toBe('Ada');
    }
  });

  it('omits the address key entirely when the sale has no contact', () => {
    const request = buildCounterSaleRequest({ channel: OrderType.Delivery, lines: [line], notes: '' });
    expect('deliveryAddress' in request).toBe(false);
    expect(request.customerName).toBeUndefined();
  });
});
