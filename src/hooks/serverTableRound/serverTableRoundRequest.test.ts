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
});
