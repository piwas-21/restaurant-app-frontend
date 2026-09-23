import { OrderType } from '@/types/order';
import { buildServerTableRoundCommand } from './serverTableRoundRequest';

describe('buildServerTableRoundCommand', () => {
  it('keeps stable alphanumeric table identity and the explicit session', () => {
    const command = buildServerTableRoundCommand({
      tableId: 'T-QA/3',
      serviceSessionId: 'session-1',
      notes: '  allergy note  ',
      clientOperationId: 'round-1',
      items: [{ product: { id: 'p1', name: 'Soup' }, quantity: 1, unitPrice: 8, selectedIngredientIds: [] }],
    });
    expect(command).toMatchObject({
      type: OrderType.DineIn,
      tableId: 'T-QA/3',
      serviceSessionId: 'session-1',
      paymentState: 'Unpaid',
      releaseToKitchen: true,
      clientOperationId: 'round-1',
      notes: 'allergy note',
    });
    expect(command.items[0]).toMatchObject({ productId: 'p1', selectedIngredientIds: [] });
    expect(command).not.toHaveProperty('tableNumber');
  });

  it('includes customer attribution and only sends points when loyalty is enabled', () => {
    const customer = {
      customerUserId: 'user-7',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.test',
      customerPhone: '+41220000000',
      currentPoints: 120,
      pointsToRedeem: 50,
    };
    const attributed = buildServerTableRoundCommand({
      tableId: 'table-a',
      serviceSessionId: 'session-a',
      items: [{ product: { id: 'p1', name: 'Soup' }, quantity: 1, unitPrice: 8 }],
      notes: '',
      clientOperationId: 'op-a',
      customer,
    });
    expect(attributed).toMatchObject({ customerUserId: 'user-7', customerEmail: 'ada@example.test' });
    expect(attributed).not.toHaveProperty('pointsToRedeem');
    expect(
      buildServerTableRoundCommand({
        tableId: 'table-a',
        serviceSessionId: 'session-a',
        items: [{ product: { id: 'p1', name: 'Soup' }, quantity: 1, unitPrice: 8 }],
        notes: '',
        clientOperationId: 'op-a',
        customer,
        loyaltyEnabled: true,
      }).pointsToRedeem,
    ).toBe(50);
  });
});
