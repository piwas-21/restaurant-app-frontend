import { OrderType } from '@/types/order';
import { mapMenuProducts } from './menuProductMapper';

describe('mapMenuProducts', () => {
  it('preserves the server-resolved channel availability verdict', () => {
    const availability = {
      canOrder: false,
      reason: 'WrongOrderType' as const,
      allowedOrderTypes: [OrderType.DineIn],
    };

    const [mapped] = mapMenuProducts([
      {
        id: 'product-1',
        name: 'Soup',
        basePrice: 8,
        isActive: true,
        isAvailable: true,
        type: 'mainItem',
        availability,
      },
    ]);

    expect(mapped.availability).toEqual(availability);
  });
});
