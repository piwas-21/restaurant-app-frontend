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

  it('skips an inactive first variation and starts on the first one the guest can SEE', () => {
    // `VariationsSection` renders active variations only, so `variations[0]` opened the sheet on a
    // selection with no radio. Load-bearing since Track F / F2: a product that hides its base row
    // has nothing else to start on, and a null start is an add the server refuses.
    const seed = buildInitialSheetState(
      detail({
        variations: [
          { id: 'sold-out', isActive: false, displayOrder: 0 },
          { id: 'revani', isActive: true, displayOrder: 1 },
        ],
      } as Partial<DetailedProduct>),
    );

    expect(seed.selectedVariationId).toBe('revani');
  });

  it('falls back to the base row when every variation is inactive', () => {
    // The degrade: no active variation means the base row is shown again (`isBaseRowHidden`), so
    // starting on nothing is correct here rather than a hole.
    const seed = buildInitialSheetState(
      detail({ variations: [{ id: 'sold-out', isActive: false, displayOrder: 0 }] } as Partial<DetailedProduct>),
    );

    expect(seed.selectedVariationId).toBeNull();
  });
});
