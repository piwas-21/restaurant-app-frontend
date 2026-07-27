import { hasItemsForKitchen, selectItemsForKitchen } from './orderItemTree';
import { makeOrderItem, singleKitchenBundleOrder, mixedKitchenBundleOrder } from './__fixtures__/bundleOrderFixture';

const names = (items: { productName?: string }[]) => items.map((i) => i.productName);

describe('hasItemsForKitchen', () => {
  it('is false for an empty or missing list', () => {
    expect(hasItemsForKitchen(undefined, 'BackKitchen')).toBe(false);
    expect(hasItemsForKitchen([], 'BackKitchen')).toBe(false);
  });

  it('finds a kitchen that only appears on a nested bundle component', () => {
    const { items } = mixedKitchenBundleOrder();
    // No TOP-LEVEL item is BackKitchen — the fries live in the combo's sideItems.
    expect(items.some((i) => i.kitchenType === 'BackKitchen')).toBe(false);
    expect(hasItemsForKitchen(items, 'BackKitchen')).toBe(true);
    expect(hasItemsForKitchen(items, 'FrontKitchen')).toBe(true);
  });

  it('is false when no item at any depth is routed to that kitchen', () => {
    expect(hasItemsForKitchen(singleKitchenBundleOrder().items, 'BackKitchen')).toBe(false);
  });

  it('recurses past a level with no match', () => {
    const deep = [
      makeOrderItem({
        id: 'root',
        productName: 'Platter',
        kitchenType: 'FrontKitchen',
        sideItems: [
          makeOrderItem({
            id: 'mid',
            productName: 'Wrap',
            kitchenType: 'FrontKitchen',
            sideItems: [makeOrderItem({ id: 'leaf', productName: 'Fries', kitchenType: 'BackKitchen' })],
          }),
        ],
      }),
    ];
    expect(hasItemsForKitchen(deep, 'BackKitchen')).toBe(true);
  });
});

describe('selectItemsForKitchen', () => {
  it('keeps a matching parent with only its matching children nested', () => {
    const selected = selectItemsForKitchen(singleKitchenBundleOrder().items, 'FrontKitchen');

    expect(names(selected)).toEqual(['Mezze Combo']);
    expect(names(selected[0].sideItems ?? [])).toEqual(['Hummus', 'Fattoush Salad']);
  });

  it('returns nothing for a kitchen with no items anywhere in the tree', () => {
    expect(selectItemsForKitchen(singleKitchenBundleOrder().items, 'BackKitchen')).toEqual([]);
  });

  it('returns nothing for an empty or missing list', () => {
    expect(selectItemsForKitchen(undefined, 'BackKitchen')).toEqual([]);
    expect(selectItemsForKitchen([], 'BackKitchen')).toEqual([]);
  });

  it('drops the other kitchen’s children from a matching parent', () => {
    const front = selectItemsForKitchen(mixedKitchenBundleOrder().items, 'FrontKitchen');

    expect(names(front)).toEqual(['Burger Combo']);
    expect(names(front[0].sideItems ?? [])).toEqual(['Beef Burger']);
  });

  it('hoists a matching child out of a non-matching parent', () => {
    const back = selectItemsForKitchen(mixedKitchenBundleOrder().items, 'BackKitchen');

    // The combo itself is FrontKitchen, so the back kitchen sees the fries at the top level.
    expect(names(back)).toEqual(['Fries']);
    expect(back[0].sideItems).toEqual([]);
  });

  it('hoists through arbitrary depth', () => {
    const deep = [
      makeOrderItem({
        id: 'root',
        productName: 'Platter',
        kitchenType: 'FrontKitchen',
        sideItems: [
          makeOrderItem({
            id: 'mid',
            productName: 'Wrap',
            kitchenType: 'FrontKitchen',
            sideItems: [makeOrderItem({ id: 'leaf', productName: 'Baklava', kitchenType: 'BackKitchen' })],
          }),
        ],
      }),
    ];

    expect(names(selectItemsForKitchen(deep, 'BackKitchen'))).toEqual(['Baklava']);

    const front = selectItemsForKitchen(deep, 'FrontKitchen');
    expect(names(front)).toEqual(['Platter']);
    expect(names(front[0].sideItems ?? [])).toEqual(['Wrap']);
    expect(front[0].sideItems?.[0].sideItems).toEqual([]);
  });

  it('does not mutate the source tree', () => {
    const order = mixedKitchenBundleOrder();
    selectItemsForKitchen(order.items, 'FrontKitchen');

    expect(names(order.items[0].sideItems ?? [])).toEqual(['Beef Burger', 'Fries']);
  });
});
