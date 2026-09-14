import { areCustomizationGroupsValid } from './customizationGroupDraft';
import type { ProductCustomizationGroupDraft } from '@/types/menu';

const group = (overrides: Partial<ProductCustomizationGroupDraft> = {}): ProductCustomizationGroupDraft => ({
  name: 'Viande',
  displayOrder: 0,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  includedFreeUnits: 1,
  isActive: true,
  content: {},
  ingredientOptions: [{ productIngredientId: 'meat', displayOrder: 0, isDefault: false }],
  productOptions: [],
  ...overrides,
});

describe('areCustomizationGroupsValid', () => {
  it('accepts limits on their valid boundaries', () => {
    expect(areCustomizationGroupsValid([group()])).toBe(true);
    expect(areCustomizationGroupsValid([group({ isRequired: false, minSelection: 0 })])).toBe(true);
  });

  it.each([
    group({ name: ' ' }),
    group({ minSelection: -1 }),
    group({ minSelection: 2, maxSelection: 1 }),
    group({ maxSelection: 2 }),
    group({ includedFreeUnits: 2 }),
    group({ minSelection: 0 }),
  ])('rejects an invalid name or cardinality boundary', (candidate) => {
    expect(areCustomizationGroupsValid([candidate])).toBe(false);
  });
});
