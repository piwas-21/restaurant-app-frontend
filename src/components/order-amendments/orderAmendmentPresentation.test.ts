import type { OrderDto } from '@/types/order';
import { orderNeedsPreparingOverride, toAmendmentItemSnapshot } from './orderAmendmentPresentation';

describe('order amendment presentation helpers', () => {
  it('requires a kitchen acknowledgement for Preparing/Ready corrections, including paid orders', () => {
    const preparingPaid = { status: 'Preparing', paymentStatus: 'Paid' } as OrderDto;
    const readyPartPaid = { status: 'Ready', paymentStatus: 'PartiallyPaid' } as OrderDto;
    const delivered = { status: 'Delivered', paymentStatus: 'Paid' } as OrderDto;

    expect(orderNeedsPreparingOverride(preparingPaid, true)).toBe(true);
    expect(orderNeedsPreparingOverride(readyPartPaid, true)).toBe(true);
    expect(orderNeedsPreparingOverride(preparingPaid, false)).toBe(false);
    expect(orderNeedsPreparingOverride(delivered, true)).toBe(false);
  });

  it('copies the complete nested source snapshot for instruction changes and replacements', () => {
    const source = {
      id: 'root-1',
      productId: 'product-1',
      productVariationId: 'variation-1',
      menuId: 'menu-1',
      quantity: 2,
      unitPrice: 12,
      customizationPrice: 1.5,
      specialInstructions: 'No salt',
      selectedIngredientIds: ['ingredient-1'],
      ingredientQuantities: { 'ingredient-1': 2 },
      sectionId: 'section-1',
      kind: 'Bundle',
      sideItems: [
        {
          id: 'child-1',
          productId: 'side-1',
          quantity: 1,
          unitPrice: 0,
          selectedIngredientIds: ['child-ingredient'],
          ingredientQuantities: { 'child-ingredient': 1 },
          sideItems: [],
        },
      ],
    } as unknown as OrderDto['items'][number];

    const snapshot = toAmendmentItemSnapshot(source);

    expect(snapshot).toMatchObject({
      productId: 'product-1',
      productVariationId: 'variation-1',
      menuId: 'menu-1',
      quantity: 2,
      unitPrice: 12,
      customizationPrice: 1.5,
      selectedIngredientIds: ['ingredient-1'],
      ingredientQuantities: { 'ingredient-1': 2 },
      sectionId: 'section-1',
      kind: 'Bundle',
      childItems: [{ productId: 'side-1', selectedIngredientIds: ['child-ingredient'] }],
    });
    expect(snapshot.selectedIngredientIds).not.toBe(source.selectedIngredientIds);
    expect(snapshot.childItems?.[0].selectedIngredientIds).not.toBe(source.sideItems?.[0].selectedIngredientIds);
  });

  it('uses a nullable menu-backed source identity without inventing an empty ProductId', () => {
    const source = {
      id: 'menu-line-1',
      productId: null,
      menuID: 'menu-1',
      quantity: 2,
      unitPrice: 18,
      specialInstructions: 'Keep chilled',
      sideItems: [
        {
          id: 'menu-child-1',
          productId: null,
          menuID: 'menu-child-1',
          quantity: 1,
          unitPrice: 0,
          specialInstructions: 'Do not garnish',
          sideItems: [],
        },
      ],
    } as unknown as OrderDto['items'][number];

    const snapshot = toAmendmentItemSnapshot(source);

    expect(snapshot).toMatchObject({
      menuId: 'menu-1',
      quantity: 2,
      specialInstructions: 'Keep chilled',
      childItems: [{ menuId: 'menu-child-1', specialInstructions: 'Do not garnish' }],
    });
    expect(snapshot).not.toHaveProperty('productId');
    expect(snapshot.childItems?.[0]).not.toHaveProperty('productId');
  });
});
