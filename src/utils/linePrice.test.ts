import {
  ingredientCustomizationPrice,
  productLineUnitPrice,
  bundleLineUnitPrice,
  lineTotal,
  type PriceableIngredient,
} from './linePrice';
import { buildBaseIngredientSelection } from './ingredientSelection';

// Helpers to build ingredients tersely.
const ing = (over: Partial<PriceableIngredient> & { id: string }): PriceableIngredient => ({
  price: 0,
  isOptional: true,
  isActive: true,
  ...over,
});

describe('ingredientCustomizationPrice — FE↔BE parity with BasketPricingService.CalculateIngredientCustomizationPrice', () => {
  it('returns 0 for missing/empty ingredients', () => {
    expect(ingredientCustomizationPrice(undefined, [])).toBe(0);
    expect(ingredientCustomizationPrice([], ['x'])).toBe(0);
  });

  it('ignores required (non-optional) and inactive ingredients', () => {
    const ingredients = [
      ing({ id: 'req', isOptional: false, price: 5 }),
      ing({ id: 'inactive', isActive: false, price: 5, isIncludedInBasePrice: false }),
    ];
    // Neither contributes even when "selected".
    expect(ingredientCustomizationPrice(ingredients, ['req', 'inactive'])).toBe(0);
  });

  describe('included-in-base ingredient', () => {
    const cheese = ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true, maxQuantity: 3 });

    it('selected at qty 1 → 0 (already in base)', () => {
      expect(ingredientCustomizationPrice([cheese], ['cheese'], { cheese: 1 })).toBe(0);
    });
    it('deselected → refunds the included piece (−price)', () => {
      expect(ingredientCustomizationPrice([cheese], [])).toBe(-2);
    });
    it('selected at qty 3 → charges the 2 extra pieces (+price·(qty−1))', () => {
      expect(ingredientCustomizationPrice([cheese], ['cheese'], { cheese: 3 })).toBe(4);
    });
  });

  describe('not-included optional ingredient', () => {
    const bacon = ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false, maxQuantity: 2 });

    it('not selected → 0', () => {
      expect(ingredientCustomizationPrice([bacon], [])).toBe(0);
    });
    it('selected at qty 2 → +price·qty', () => {
      expect(ingredientCustomizationPrice([bacon], ['bacon'], { bacon: 2 })).toBe(6);
    });
  });

  it('clamps quantity to [0, maxQuantity] (guards price tampering)', () => {
    const bacon = ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false, maxQuantity: 2 });
    // qty 5 clamped to 2 → 6, not 15.
    expect(ingredientCustomizationPrice([bacon], ['bacon'], { bacon: 5 })).toBe(6);
    // negative qty clamped to 0 → 0, not a negative (price-reducing) contribution.
    expect(ingredientCustomizationPrice([bacon], ['bacon'], { bacon: -4 })).toBe(0);
  });

  it('accepts either a Set or an array of selected ids', () => {
    const bacon = ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false });
    expect(ingredientCustomizationPrice([bacon], new Set(['bacon']))).toBe(3);
    expect(ingredientCustomizationPrice([bacon], ['bacon'])).toBe(3);
  });
});

describe('productLineUnitPrice', () => {
  it('is just the base price with no customization', () => {
    expect(productLineUnitPrice({ basePrice: 10, selectedIngredientIds: [] })).toBe(10);
  });

  it('adds the selected variation modifier (additive) and ingredient + side costs', () => {
    const price = productLineUnitPrice({
      basePrice: 10,
      variations: [{ id: 'lg', priceModifier: 2 }],
      selectedVariationId: 'lg',
      ingredients: [ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false })],
      selectedIngredientIds: ['bacon'],
      sides: [{ id: 'fries', price: 4 }],
      selectedSides: [{ id: 'fries', quantity: 2 }],
    });
    // 10 + 2 (variation) + 3 (bacon) + 8 (2×fries) = 23
    expect(price).toBe(23);
  });

  it('starts a default (base-recipe) selection at exactly the base price', () => {
    const ingredients = [
      ing({ id: 'dough', isOptional: false, price: 5 }),
      ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true }),
      ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false }),
    ];
    const { selectedIngredients, ingredientQuantities } = buildBaseIngredientSelection(ingredients);
    const price = productLineUnitPrice({
      basePrice: 12,
      ingredients,
      selectedIngredientIds: selectedIngredients,
      ingredientQuantities,
    });
    expect(price).toBe(12);
  });
});

describe('bundleLineUnitPrice', () => {
  const sections = [
    {
      id: 'main',
      items: [
        {
          productId: 'pizza',
          additionalPrice: 2.99,
          detailedIngredients: [ing({ id: 'olives', price: 1, isIncludedInBasePrice: false })],
        },
      ],
    },
    { id: 'drink', items: [{ productId: 'cola', additionalPrice: 1.99 }] },
  ];

  it('sums base + section additionals + per-option child customization, scaled by option qty', () => {
    const price = bundleLineUnitPrice({
      basePrice: 8,
      sections,
      selectedOptions: [
        { sectionId: 'main', itemId: 'pizza', quantity: 1, selectedIngredients: ['olives'] },
        { sectionId: 'drink', itemId: 'cola', quantity: 1 },
      ],
    });
    // 8 + 2.99 + 1 (olives) + 1.99 = 13.98
    expect(price).toBeCloseTo(13.98, 5);
  });

  it('skips an option that does not resolve to a section item', () => {
    const price = bundleLineUnitPrice({
      basePrice: 8,
      sections,
      selectedOptions: [{ sectionId: 'main', itemId: 'unknown', quantity: 1 }],
    });
    expect(price).toBe(8);
  });
});

describe('lineTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineTotal(13.98, 3)).toBeCloseTo(41.94, 5);
  });
});
