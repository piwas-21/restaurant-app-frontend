import { orderItemToLineSummary, isLineSummaryEmpty } from './lineSummary';
import type { OrderItemDto } from '@/types/order';

const orderItem = (over: Partial<OrderItemDto>): OrderItemDto => ({
  id: 'i1',
  productId: 'p1',
  productName: 'Item',
  quantity: 1,
  unitPrice: 10,
  itemTotal: 10,
  ...over,
});

describe('orderItemToLineSummary', () => {
  it('maps ingredient customizations to a diff: extras (qty>1) added, removed flagged, defaults (qty 1) skipped', () => {
    const summary = orderItemToLineSummary(
      orderItem({
        ingredientCustomizations: [
          { ingredientId: 'a', ingredientName: 'Cheese', quantity: 2, isRemoved: false }, // extra
          { ingredientId: 'b', ingredientName: 'Onion', quantity: 0, isRemoved: true }, // removed
          { ingredientId: 'c', ingredientName: 'Sauce', quantity: 1, isRemoved: false }, // unchanged default → skipped
        ],
      }),
    );
    expect(summary.diff.added).toEqual([{ name: 'Cheese', quantity: 2 }]);
    expect(summary.diff.removed).toEqual(['Onion']);
  });

  it('splits children by kind: BundleChild → components (with diffs), SideItem → add-on sides', () => {
    const summary = orderItemToLineSummary(
      orderItem({
        sideItems: [
          {
            id: 'c1',
            productId: 'pc',
            productName: 'Coke',
            quantity: 1,
            unitPrice: 0,
            itemTotal: 0,
            kind: 'BundleChild',
            ingredientCustomizations: [{ ingredientId: 'x', ingredientName: 'Ice', quantity: 0, isRemoved: true }],
          },
          {
            id: 's1',
            productId: 'ps',
            productName: 'Fries',
            quantity: 2,
            unitPrice: 3,
            itemTotal: 6,
            kind: 'SideItem',
          },
        ],
      }),
    );
    expect(summary.children).toHaveLength(1);
    expect(summary.children[0]).toMatchObject({ name: 'Coke', quantity: 1 });
    expect(summary.children[0].diff.removed).toEqual(['Ice']);
    expect(summary.sideItems).toEqual([{ id: 's1', name: 'Fries', quantity: 2, price: 6 }]);
  });

  it('treats undefined kind (pre-#158 historical orders) as a bundle component', () => {
    const summary = orderItemToLineSummary(
      orderItem({
        sideItems: [{ id: 'c1', productId: 'pc', productName: 'Coke', quantity: 1, unitPrice: 0, itemTotal: 0 }],
      }),
    );
    expect(summary.children).toHaveLength(1);
    expect(summary.sideItems).toHaveLength(0);
  });

  it('carries special instructions', () => {
    const summary = orderItemToLineSummary(orderItem({ specialInstructions: 'No salt' }));
    expect(summary.specialInstructions).toBe('No salt');
    expect(isLineSummaryEmpty(summary)).toBe(false);
  });
});

describe('isLineSummaryEmpty', () => {
  it('is true when a plain item has nothing to show', () => {
    expect(isLineSummaryEmpty(orderItemToLineSummary(orderItem({})))).toBe(true);
  });
});
