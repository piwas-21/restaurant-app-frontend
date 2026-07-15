import { buildInitialSheetState, hasCustomizationOptions } from './itemSheetState';
import { productLineUnitPrice } from './linePrice';
import type { DetailedProduct } from '@/types/menu';

const detail = (over: Partial<DetailedProduct> = {}): DetailedProduct =>
  ({
    id: 'p1',
    name: 'Pizza',
    basePrice: 10,
    isActive: true,
    isAvailable: true,
    isSpecial: false,
    type: 'mainItem',
    ingredients: [],
    allergens: [],
    displayOrder: 1,
    content: {},
    images: [],
    categories: [],
    variations: [],
    suggestedSideItems: [],
    detailedIngredients: [],
    ...over,
  }) as DetailedProduct;

describe('hasCustomizationOptions', () => {
  it('is false when there is nothing to choose — the card adds such a product directly', () => {
    expect(hasCustomizationOptions(detail())).toBe(false);
  });

  it.each([
    ['variations', { variations: [{ id: 'v1' }] }],
    ['ingredients', { detailedIngredients: [{ id: 'i1' }] }],
    ['suggested sides', { suggestedSideItems: [{ id: 's1' }] }],
  ])('is true when the product has %s', (_label, over) => {
    expect(hasCustomizationOptions(detail(over as Partial<DetailedProduct>))).toBe(true);
  });
});

describe('buildInitialSheetState', () => {
  const cheese = {
    id: 'cheese',
    name: 'Cheese',
    price: 2,
    isOptional: true,
    isActive: true,
    isIncludedInBasePrice: true,
    maxQuantity: 3,
    displayOrder: 1,
  };
  const bacon = {
    id: 'bacon',
    name: 'Bacon',
    price: 3,
    isOptional: true,
    isActive: true,
    isIncludedInBasePrice: false,
    maxQuantity: 2,
    displayOrder: 2,
  };

  it('seeds the base recipe, the required sides and the first variation', () => {
    const seed = buildInitialSheetState(
      detail({
        detailedIngredients: [cheese, bacon],
        variations: [{ id: 'v1' }, { id: 'v2' }],
        suggestedSideItems: [
          { id: 'fries', isRequired: true },
          { id: 'salad', isRequired: false },
        ],
      } as Partial<DetailedProduct>),
    );

    expect(seed.selectedIngredients).toEqual(['cheese']); // free-in-base in, paid add-on out
    expect(seed.ingredientQuantities).toEqual({ cheese: 1 });
    expect(seed.selectedSideItems).toEqual([{ id: 'fries', quantity: 1 }]);
    expect(seed.selectedVariationId).toBe('v1');
  });

  it('starts the line at exactly the advertised base price (customization delta 0)', () => {
    const product = detail({ basePrice: 10, detailedIngredients: [cheese, bacon] } as Partial<DetailedProduct>);
    const seed = buildInitialSheetState(product);

    const unitPrice = productLineUnitPrice({
      basePrice: 10,
      ingredients: [cheese, bacon],
      selectedIngredientIds: seed.selectedIngredients,
      ingredientQuantities: seed.ingredientQuantities,
    });

    expect(unitPrice).toBe(10);
  });

  it('selects no variation when the product has none', () => {
    expect(buildInitialSheetState(detail()).selectedVariationId).toBeNull();
  });
});
