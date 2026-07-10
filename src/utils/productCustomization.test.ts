import type { DetailedIngredient, MenuSectionSuggestedSideItem } from '@/types/menu';
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

const side = (
  partial: Partial<MenuSectionSuggestedSideItem> & Pick<MenuSectionSuggestedSideItem, 'id' | 'sideItemBasePrice'>,
): MenuSectionSuggestedSideItem => ({
  sideItemProductId: `p-${partial.id}`,
  isRequired: false,
  displayOrder: 0,
  ...partial,
});

const price = (
  base: number,
  ingredients: DetailedIngredient[] = [],
  selected: string[] = [],
  quantities: Record<string, number> = {},
  sides: Map<string, number> = new Map(),
  suggested: MenuSectionSuggestedSideItem[] = [],
) => calculateCustomizationPrice(base, ingredients, new Set(selected), quantities, sides, suggested);

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

  describe('side items', () => {
    const fries = side({ id: 's1', sideItemBasePrice: 4 });

    it('adds sideItemBasePrice × quantity for a matched side', () => {
      expect(price(10, [], [], {}, new Map([['s1', 2]]), [fries])).toBe(18); // 10 + 4*2
    });

    it('ignores a selected side that is not in the suggested list', () => {
      expect(price(10, [], [], {}, new Map([['unknown', 5]]), [fries])).toBe(10);
    });
  });

  it('combines base, ingredient deductions/additions, and sides', () => {
    const cheese = ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true, isOptional: true }); // deselect → −2
    const bacon = ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false, isOptional: true }); // ×2 → +6
    const fries = side({ id: 's1', sideItemBasePrice: 4 }); // ×1 → +4
    const total = price(10, [cheese, bacon], ['bacon'], { bacon: 2 }, new Map([['s1', 1]]), [fries]);
    expect(total).toBe(18); // 10 − 2 + 6 + 4
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
