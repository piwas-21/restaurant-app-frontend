import type { BasketItemDto } from '@/types/basket';
import { buildOrderItems } from '@/utils/orderItemsPayload';

const basketItem = (partial: Partial<BasketItemDto>): BasketItemDto => ({
  productId: 'prod-1',
  quantity: 1,
  unitPrice: 10,
  itemTotal: 10,
  ...partial,
});

describe('buildOrderItems', () => {
  describe('regular items (payload identical to the pre-#150 inline mapping)', () => {
    it('maps a plain item without customizations', () => {
      const result = buildOrderItems([basketItem({ productId: 'p1', quantity: 2, unitPrice: 5.5 })]);

      expect(result).toEqual([
        {
          productId: 'p1',
          productVariationId: undefined,
          menuId: undefined,
          quantity: 2,
          unitPrice: 5.5,
          customizationPrice: 0,
          specialInstructions: undefined,
          ingredientQuantities: undefined,
        },
      ]);
    });

    it('falls back to an empty productId and 0 customizationPrice', () => {
      const [item] = buildOrderItems([basketItem({ productId: undefined })]);

      expect(item.productId).toBe('');
      expect(item.customizationPrice).toBe(0);
    });

    it('passes variation, menu id, instructions and customization price through', () => {
      const [item] = buildOrderItems([
        basketItem({
          productVariationId: 'var-1',
          menuId: 'menu-1',
          specialInstructions: 'no salt',
          customizationPrice: 1.5,
        }),
      ]);

      expect(item).toMatchObject({
        productVariationId: 'var-1',
        menuId: 'menu-1',
        specialInstructions: 'no salt',
        customizationPrice: 1.5,
      });
    });

    it('keeps ingredientQuantities and zeroes ingredients missing from selectedIngredients', () => {
      const [item] = buildOrderItems([
        basketItem({
          ingredientQuantities: { cheese: 2, bacon: 1 },
          selectedIngredients: ['cheese'],
        }),
      ]);

      expect(item.ingredientQuantities).toEqual({ cheese: 2, bacon: 0 });
    });

    it('omits ingredientQuantities when the basket map is empty or absent', () => {
      const [absent, empty] = buildOrderItems([
        basketItem({}),
        basketItem({ ingredientQuantities: {}, selectedIngredients: ['cheese'] }),
      ]);

      expect(absent.ingredientQuantities).toBeUndefined();
      expect(empty.ingredientQuantities).toBeUndefined();
    });

    it('does not zero anything when selectedIngredients is absent', () => {
      const [item] = buildOrderItems([basketItem({ ingredientQuantities: { cheese: 2 } })]);

      expect(item.ingredientQuantities).toEqual({ cheese: 2 });
    });
  });

  describe('side items (payload identical to the pre-#150 inline mapping)', () => {
    it('maps selected side items to child items', () => {
      const [item] = buildOrderItems([
        basketItem({
          selectedSideItems: [
            { id: 'side-1', name: 'Fries', price: 3, quantity: 2, subTotal: 6 },
            { id: 'side-2', name: 'Dip', price: 0, quantity: 1, subTotal: 0 },
          ],
        }),
      ]);

      expect(item.childItems).toEqual([
        { productId: 'side-1', quantity: 2, unitPrice: 3, customizationPrice: 0 },
        { productId: 'side-2', quantity: 1, unitPrice: 0, customizationPrice: 0 },
      ]);
    });

    it('omits childItems entirely when there are no side items and no bundle children', () => {
      const [item] = buildOrderItems([basketItem({ selectedSideItems: [] })]);

      expect(item.childItems).toBeUndefined();
    });
  });

  describe('bundle children (issue #150)', () => {
    it('maps a bundle child with an extra ingredient (quantity > 1)', () => {
      const [item] = buildOrderItems([
        basketItem({
          productId: 'bundle-1',
          childItems: [
            basketItem({
              productId: 'child-pizza',
              quantity: 1,
              unitPrice: 2,
              ingredientQuantities: { cheese: 3 },
              selectedIngredients: ['cheese'],
            }),
          ],
        }),
      ]);

      expect(item.childItems).toEqual([
        {
          productId: 'child-pizza',
          productVariationId: undefined,
          quantity: 1,
          unitPrice: 2,
          customizationPrice: 0,
          specialInstructions: undefined,
          ingredientQuantities: { cheese: 3 },
        },
      ]);
    });

    it('expresses a removal as an explicit 0 (deselected default and stored 0s both survive)', () => {
      const [item] = buildOrderItems([
        basketItem({
          productId: 'bundle-1',
          childItems: [
            basketItem({
              productId: 'child-burger',
              // onion deselected in the modal (stored as 0), pickle only missing from
              // selectedIngredients — both must reach the payload as 0
              ingredientQuantities: { onion: 0, pickle: 1, salad: 1 },
              selectedIngredients: ['salad'],
            }),
          ],
        }),
      ]);

      expect(item.childItems![0].ingredientQuantities).toEqual({ onion: 0, pickle: 0, salad: 1 });
    });

    it('maps a bundle child without customizations and keeps its special instructions', () => {
      const [item] = buildOrderItems([
        basketItem({
          productId: 'bundle-1',
          childItems: [
            basketItem({ productId: 'child-coke', quantity: 2, unitPrice: 1.5, specialInstructions: 'no ice' }),
          ],
        }),
      ]);

      expect(item.childItems).toEqual([
        {
          productId: 'child-coke',
          productVariationId: undefined,
          quantity: 2,
          unitPrice: 1.5,
          customizationPrice: 0,
          specialInstructions: 'no ice',
          ingredientQuantities: undefined,
        },
      ]);
    });

    it('always sends customizationPrice 0 for bundle children (already rolled into parent unitPrice)', () => {
      const [item] = buildOrderItems([
        basketItem({
          productId: 'bundle-1',
          childItems: [basketItem({ productId: 'child-pizza', customizationPrice: 4 })],
        }),
      ]);

      expect(item.childItems![0].customizationPrice).toBe(0);
    });

    it('falls back to an empty productId for a child without one', () => {
      const [item] = buildOrderItems([basketItem({ childItems: [basketItem({ productId: undefined })] })]);

      expect(item.childItems![0].productId).toBe('');
    });

    it('recurses into nested children', () => {
      const [item] = buildOrderItems([
        basketItem({
          productId: 'bundle-1',
          childItems: [
            basketItem({
              productId: 'child-combo',
              childItems: [basketItem({ productId: 'grandchild', ingredientQuantities: { mayo: 1 } })],
            }),
          ],
        }),
      ]);

      expect(item.childItems![0].childItems![0]).toMatchObject({
        productId: 'grandchild',
        ingredientQuantities: { mayo: 1 },
      });
    });

    it('appends bundle children after side items when both exist', () => {
      const [item] = buildOrderItems([
        basketItem({
          selectedSideItems: [{ id: 'side-1', name: 'Fries', price: 3, quantity: 1, subTotal: 3 }],
          childItems: [basketItem({ productId: 'child-coke' })],
        }),
      ]);

      expect(item.childItems!.map((c) => c.productId)).toEqual(['side-1', 'child-coke']);
    });
  });

  describe('wire format', () => {
    it('serializes a regular item to the exact same JSON as before the bundle-child change', () => {
      const json = JSON.stringify(
        buildOrderItems([
          basketItem({
            productId: 'p1',
            quantity: 1,
            unitPrice: 12,
            customizationPrice: 2,
            specialInstructions: 'rare',
            ingredientQuantities: { cheese: 1, bacon: 1 },
            selectedIngredients: ['cheese'],
            selectedSideItems: [{ id: 'side-1', name: 'Fries', price: 3, quantity: 1, subTotal: 3 }],
          }),
        ]),
      );

      expect(json).toBe(
        '[{"productId":"p1","quantity":1,"unitPrice":12,"customizationPrice":2,' +
          '"specialInstructions":"rare","ingredientQuantities":{"cheese":1,"bacon":0},' +
          '"childItems":[{"productId":"side-1","quantity":1,"unitPrice":3,"customizationPrice":0}]}]',
      );
    });
  });
});
