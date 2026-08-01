import { orderItemToLineSummary, basketItemToLineSummary, isLineSummaryEmpty } from './lineSummary';
import type { OrderItemDto } from '@/types/order';
import type { BasketItemDto } from '@/types/basket';

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

  it('adapts a component of a component (the tree nests deeper than one level)', () => {
    const summary = orderItemToLineSummary(
      orderItem({
        sideItems: [
          {
            id: 'c1',
            productId: 'pc',
            productName: 'Mezze Selection',
            quantity: 1,
            unitPrice: 0,
            itemTotal: 0,
            kind: 'BundleChild',
            sideItems: [
              {
                id: 'g1',
                productId: 'pg',
                productName: 'Hummus',
                quantity: 2,
                unitPrice: 0,
                itemTotal: 0,
                kind: 'BundleChild',
              },
            ],
          },
        ],
      }),
    );

    expect(summary.children[0].children).toEqual([
      {
        id: 'g1',
        name: 'Hummus',
        quantity: 2,
        diff: { added: [], removed: [] },
        specialInstructions: undefined,
        children: [],
      },
    ]);
  });

  it('carries special instructions', () => {
    const summary = orderItemToLineSummary(orderItem({ specialInstructions: 'No salt' }));
    expect(summary.specialInstructions).toBe('No salt');
    expect(isLineSummaryEmpty(summary)).toBe(false);
  });
});

describe('basketItemToLineSummary', () => {
  it('maps added (with quantity), sides, and child components', () => {
    const item: BasketItemDto = {
      quantity: 1,
      unitPrice: 10,
      itemTotal: 10,
      productName: 'Pizza',
      selectedIngredients: ['id-cheese', 'id-bacon'],
      selectedIngredientNames: ['Cheese', 'Bacon'],
      ingredientQuantities: { 'id-cheese': 2 },
      selectedSideItems: [{ id: 's1', name: 'Fries', price: 3, quantity: 2, subTotal: 6 }],
      specialInstructions: 'Crispy',
      childItems: [{ id: 'c1', quantity: 1, unitPrice: 0, itemTotal: 0, productName: 'Coke' }],
    };
    const summary = basketItemToLineSummary(item);

    expect(summary.diff.added).toEqual([
      { name: 'Cheese', quantity: 2 },
      { name: 'Bacon', quantity: 1 },
    ]);
    // The basket shape carries no removals at all — see the comment in basketDiff. The ORDER
    // side still proves removals render, via `isRemoved` (first describe block).
    expect(summary.diff.removed).toEqual([]);
    expect(summary.sideItems).toEqual([{ id: 's1', name: 'Fries', quantity: 2, price: 6 }]);
    expect(summary.specialInstructions).toBe('Crispy');
    expect(summary.children).toHaveLength(1);
    expect(summary.children[0]).toMatchObject({ id: 'c1', name: 'Coke', quantity: 1 });
    expect(summary.children[0].diff.removed).toEqual([]);
  });

  it('adapts a component of a component', () => {
    const summary = basketItemToLineSummary({
      quantity: 1,
      unitPrice: 10,
      itemTotal: 10,
      productName: 'Family Platter',
      childItems: [
        {
          id: 'c1',
          quantity: 1,
          unitPrice: 0,
          itemTotal: 0,
          productName: 'Mezze Selection',
          childItems: [{ id: 'g1', quantity: 2, unitPrice: 0, itemTotal: 0, productName: 'Hummus' }],
        },
      ],
    });

    expect(summary.children[0].children).toMatchObject([{ id: 'g1', name: 'Hummus', quantity: 2, children: [] }]);
  });

  it('is empty for a plain basket item', () => {
    const summary = basketItemToLineSummary({ quantity: 1, unitPrice: 5, itemTotal: 5, productName: 'Water' });
    expect(isLineSummaryEmpty(summary)).toBe(true);
  });
});

describe('isLineSummaryEmpty', () => {
  it('is true when a plain item has nothing to show', () => {
    expect(isLineSummaryEmpty(orderItemToLineSummary(orderItem({})))).toBe(true);
  });
});
