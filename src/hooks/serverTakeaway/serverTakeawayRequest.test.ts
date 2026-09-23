import { OrderType } from '@/types/order';
import type { OrderItem } from '@/components/catalog/orderItems';
import { buildServerTakeawayRequest } from './serverTakeawayRequest';

const item: OrderItem = {
  product: { id: 'product-1', name: 'Espresso' },
  quantity: 2,
  unitPrice: 3.5,
  selectedIngredientIds: [],
};

describe('buildServerTakeawayRequest', () => {
  it('builds a fixed unpaid takeaway payload without table-service fields', () => {
    const request = buildServerTakeawayRequest({ items: [item], notes: '  two lids  ' });

    expect(request).toMatchObject({
      type: OrderType.Takeaway,
      notes: 'two lids',
      paymentState: 'Unpaid',
      items: [{ productId: 'product-1', quantity: 2, unitPrice: 3.5, selectedIngredientIds: [] }],
    });
    expect(request.tableId).toBeUndefined();
    expect(request.tableNumber).toBeUndefined();
    expect(request.serviceSessionId).toBeUndefined();
    expect(request.deliveryAddress).toBeUndefined();
  });

  it('omits blank notes while keeping the explicit unpaid state', () => {
    const request = buildServerTakeawayRequest({ items: [item], notes: '   ' });

    expect(request.notes).toBeUndefined();
    expect(request.paymentState).toBe('Unpaid');
  });

  it('keeps customer attribution when loyalty is off and gates redemption', () => {
    const customer = {
      customerUserId: 'user-7',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.test',
      customerPhone: '+41220000000',
      currentPoints: 120,
      pointsToRedeem: 50,
    };
    const attributed = buildServerTakeawayRequest({ items: [item], notes: '', customer });
    expect(attributed).toMatchObject({ customerUserId: 'user-7', customerEmail: 'ada@example.test' });
    expect(attributed).not.toHaveProperty('pointsToRedeem');
    expect(
      buildServerTakeawayRequest({ items: [item], notes: '', customer, loyaltyEnabled: true }).pointsToRedeem,
    ).toBe(50);
  });
});
