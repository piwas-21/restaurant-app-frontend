import { OrderType } from '@/types/order';
import type { Product } from '@/app/admin/menu-management/interfaces';
import type { MenuSection } from '@/types/menu';
import { assessBundleChoiceAvailability, resolveBundleParentOrderTypes } from './bundleChoiceAvailability';

const section = (productIds: readonly string[], minSelection = 2): MenuSection => ({
  id: 'drinks',
  name: 'Drinks',
  displayOrder: 1,
  isRequired: true,
  minSelection,
  maxSelection: productIds.length,
  items: productIds.map((productId, displayOrder) => ({
    id: `option-${displayOrder}`,
    productId,
    productName: productId,
    additionalPrice: 0,
    displayOrder,
    isDefault: false,
  })),
});

function product(id: string, allowedOrderTypes: readonly OrderType[], overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    description: '',
    basePrice: 0,
    isActive: true,
    isAvailable: true,
    type: 'mainItem',
    imageUrl: null,
    images: [],
    availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [...allowedOrderTypes] },
    ...overrides,
  };
}

describe('assessBundleChoiceAvailability', () => {
  it('warns when a fresh child snapshot leaves one previously unrestricted channel below the required minimum', () => {
    const result = assessBundleChoiceAvailability(
      [section(['a', 'b', 'c', 'a', 'inactive', 'unavailable'])],
      [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery],
      [
        product('a', [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery]),
        product('b', [OrderType.DineIn, OrderType.Takeaway]),
        product('c', [OrderType.Takeaway]),
        product('inactive', [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery], { isActive: false }),
        product('unavailable', [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery], { isAvailable: false }),
      ],
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.assessment.sections[0].channels).toEqual([
      { orderType: OrderType.DineIn, orderableCount: 2, minimum: 2, meetsMinimum: true },
      { orderType: OrderType.Takeaway, orderableCount: 3, minimum: 2, meetsMinimum: true },
      { orderType: OrderType.Delivery, orderableCount: 1, minimum: 2, meetsMinimum: false },
    ]);
    expect(result.assessment.warnings).toEqual([
      {
        sectionId: 'drinks',
        sectionName: 'Drinks',
        orderType: OrderType.Delivery,
        minimum: 2,
        orderableCount: 1,
      },
    ]);
  });

  it('keeps intentional channel-specific option sets separate and only checks parent-enabled channels', () => {
    const result = assessBundleChoiceAvailability(
      [section(['takeaway', 'delivery'], 1)],
      [OrderType.Takeaway, OrderType.Delivery],
      [product('takeaway', [OrderType.Takeaway]), product('delivery', [OrderType.Delivery])],
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(
      result.assessment.sections[0].channels.map(({ orderType, orderableCount }) => [orderType, orderableCount]),
    ).toEqual([
      [OrderType.Takeaway, 1],
      [OrderType.Delivery, 1],
    ]);
    expect(result.assessment.warnings).toEqual([]);
  });

  it('refuses to assess when any referenced child is absent or lacks the server availability DTO', () => {
    expect(assessBundleChoiceAvailability([section(['missing'])], [OrderType.DineIn], [])).toEqual({
      status: 'incomplete',
    });
    expect(
      assessBundleChoiceAvailability(
        [section(['legacy'])],
        [OrderType.DineIn],
        [product('legacy', [OrderType.DineIn], { availability: undefined })],
      ),
    ).toEqual({ status: 'incomplete' });
  });

  it('does not count an option targeting a missing or inactive variation', () => {
    const variationSection: MenuSection = {
      ...section(['drink', 'drink'], 1),
      items: [
        { ...section(['drink'], 1).items[0], productVariationId: 'active-size' },
        { ...section(['drink'], 1).items[0], id: 'inactive-size', productVariationId: 'inactive-size' },
      ],
    };
    const child = product('drink', [OrderType.DineIn], {
      variations: [
        { id: 'active-size', name: 'Large', priceModifier: 1, finalPrice: 1, isActive: true },
        { id: 'inactive-size', name: 'Old size', priceModifier: 0, finalPrice: 0, isActive: false },
      ],
    });

    const result = assessBundleChoiceAvailability([variationSection], [OrderType.DineIn], [child]);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.assessment.sections[0].channels[0].orderableCount).toBe(1);
    expect(result.assessment.sections[0].options).toEqual([
      expect.objectContaining({ productVariationId: 'active-size', isActiveVariation: true }),
      expect.objectContaining({ productVariationId: 'inactive-size', isActiveVariation: false }),
    ]);
    expect(result.assessment.warnings).toEqual([]);

    const twoActiveVariations = assessBundleChoiceAvailability(
      [{ ...variationSection, minSelection: 2 }],
      [OrderType.DineIn],
      [
        product('drink', [OrderType.DineIn], {
          variations: [
            { id: 'active-size', name: 'Large', priceModifier: 1, finalPrice: 1, isActive: true },
            { id: 'inactive-size', name: 'Small', priceModifier: 0, finalPrice: 0, isActive: true },
          ],
        }),
      ],
    );
    expect(twoActiveVariations.status).toBe('ready');
    if (twoActiveVariations.status !== 'ready') return;
    expect(twoActiveVariations.assessment.sections[0].channels[0].orderableCount).toBe(1);
    expect(twoActiveVariations.assessment.warnings).toEqual([
      expect.objectContaining({ minimum: 2, orderableCount: 1 }),
    ]);

    const missingVariation = assessBundleChoiceAvailability(
      [{ ...variationSection, minSelection: 2 }],
      [OrderType.DineIn],
      [product('drink', [OrderType.DineIn])],
    );
    expect(missingVariation.status).toBe('ready');
    if (missingVariation.status !== 'ready') return;
    expect(missingVariation.assessment.warnings).toEqual([
      expect.objectContaining({ orderType: OrderType.DineIn, minimum: 2, orderableCount: 0 }),
    ]);
  });
});

describe('resolveBundleParentOrderTypes', () => {
  it('uses the explicit pending mask before category inheritance', () => {
    expect(resolveBundleParentOrderTypes(2, 'existing', [])).toEqual({
      status: 'ready',
      orderTypes: [OrderType.Takeaway],
    });
  });

  it('inherits a null bundle mask from the selected primary category', () => {
    expect(
      resolveBundleParentOrderTypes(null, 'takeaway', [
        { id: 'takeaway', name: 'Takeaway', availableOrderTypes: 2 },
        { id: 'delivery', name: 'Delivery', availableOrderTypes: 4 },
      ]),
    ).toEqual({
      status: 'ready',
      orderTypes: [OrderType.Takeaway],
    });
  });

  it('treats a null primary-category mask as unrestricted', () => {
    expect(
      resolveBundleParentOrderTypes(null, 'unrestricted', [
        { id: 'unrestricted', name: 'Unrestricted', availableOrderTypes: null },
      ]),
    ).toEqual({
      status: 'ready',
      orderTypes: [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery],
    });
  });

  it('fails visibly when the selected primary category is missing or its mask is malformed', () => {
    expect(resolveBundleParentOrderTypes(null, '', [])).toEqual({ status: 'incomplete' });
    expect(resolveBundleParentOrderTypes(null, 'missing', [])).toEqual({ status: 'incomplete' });
    expect(resolveBundleParentOrderTypes(null, 'unknown-mask', [{ id: 'unknown-mask', name: 'Unknown mask' }])).toEqual(
      { status: 'incomplete' },
    );
    expect(
      resolveBundleParentOrderTypes(null, 'zero-mask', [
        { id: 'zero-mask', name: 'Zero mask', availableOrderTypes: 0 },
      ]),
    ).toEqual({ status: 'incomplete' });
    expect(
      resolveBundleParentOrderTypes(null, 'fractional-mask', [
        { id: 'fractional-mask', name: 'Fractional mask', availableOrderTypes: 1.5 },
      ]),
    ).toEqual({ status: 'incomplete' });
    expect(resolveBundleParentOrderTypes(0, 'bundle', [])).toEqual({ status: 'incomplete' });
  });
});
