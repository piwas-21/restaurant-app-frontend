import type { DetailedIngredient } from '@/types/menu';
import { calculateCustomizationPrice, buildDefaultIngredientSelections } from '@/utils/productCustomization';

const ing = (partial: Partial<DetailedIngredient> & Pick<DetailedIngredient, 'id'>): DetailedIngredient => ({
  name: partial.id,
  isOptional: false,
  price: 0,
  isIncludedInBasePrice: false,
  isActive: true,
  displayOrder: 0,
  maxQuantity: 5,
  ...partial,
});

const price = (
  base: number,
  ingredients: DetailedIngredient[] = [],
  selected: string[] = [],
  quantities: Record<string, number> = {},
) => calculateCustomizationPrice(base, ingredients, new Set(selected), quantities);

describe('calculateCustomizationPrice', () => {
  it('returns the base price when there is nothing to adjust', () => {
    expect(price(10)).toBe(10);
  });

  describe('included-in-base ingredients', () => {
    const inc = ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true, isOptional: true });

    it('deducts the included price when deselected', () => {
      expect(price(10, [inc], [])).toBe(8); // 10 − 2
    });

    it('does not change the price when selected at quantity 1', () => {
      expect(price(10, [inc], ['cheese'], { cheese: 1 })).toBe(10);
    });

    it('treats a missing quantity as 1 (no change when selected)', () => {
      expect(price(10, [inc], ['cheese'])).toBe(10);
    });

    it('charges only for extra quantity beyond the free one', () => {
      expect(price(10, [inc], ['cheese'], { cheese: 3 })).toBe(14); // 10 + 2*(3−1)
    });
  });

  describe('optional ingredients not included in the base', () => {
    const extra = ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false, isOptional: true });

    it('adds price × quantity when selected', () => {
      expect(price(10, [extra], ['bacon'], { bacon: 2 })).toBe(16); // 10 + 3*2
    });

    it('adds nothing when not selected', () => {
      expect(price(10, [extra], [])).toBe(10);
    });

    it('defaults quantity to 1 when unspecified', () => {
      expect(price(10, [extra], ['bacon'])).toBe(13);
    });
  });

  it('combines base and ingredient deductions/additions', () => {
    const cheese = ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true, isOptional: true }); // deselect → −2
    const bacon = ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false, isOptional: true }); // ×2 → +6
    const total = price(10, [cheese, bacon], ['bacon'], { bacon: 2 });
    expect(total).toBe(14); // 10 − 2 + 6
  });
});

describe('buildDefaultIngredientSelections', () => {
  it('selects every ingredient (optional and not) at quantity 1', () => {
    const result = buildDefaultIngredientSelections([
      ing({ id: 'a', isOptional: false }),
      ing({ id: 'b', isOptional: true }),
    ]);
    expect([...result.selected].sort()).toEqual(['a', 'b']);
    expect(result.quantities).toEqual({ a: 1, b: 1 });
  });

  it('returns empty selections for no ingredients', () => {
    const result = buildDefaultIngredientSelections([]);
    expect(result.selected.size).toBe(0);
    expect(result.quantities).toEqual({});
  });
});
