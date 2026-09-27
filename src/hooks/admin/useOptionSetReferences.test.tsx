import { act, renderHook } from '@testing-library/react';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetEntry } from '@/types/optionSet';
import { isOptionSetReferenceAvailable } from '@/services/optionSetReferenceService';
import { useOptionSetReferences } from './useOptionSetReferences';

jest.mock('@/services/optionSetReferenceService', () => ({
  isOptionSetReferenceAvailable: jest.fn(),
  getOptionSetProductVariations: jest.fn(),
}));

function ingredientEntry(id: string, globalIngredientId: string): OptionSetEntry {
  return {
    id,
    name: `Ingredient ${globalIngredientId}`,
    displayOrder: 0,
    globalIngredientId,
    isOptional: true,
    maxQuantity: 1,
    price: 0,
    isIncludedInBasePrice: false,
    isRequired: false,
    additionalPrice: 0,
    isDefault: false,
  };
}

function ingredientCandidate(overrides: Partial<MenuAuthoringCandidate> = {}): MenuAuthoringCandidate {
  return {
    id: 'ingredient-new',
    type: 'ingredient',
    name: 'New ingredient',
    matchSource: 'name',
    isComponent: false,
    isActive: true,
    isAvailable: true,
    ...overrides,
  };
}

describe('useOptionSetReferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps many unchanged saved references available without per-entry detail requests', () => {
    const entries = Array.from({ length: 30 }, (_, index) => ingredientEntry(`entry-${index}`, `ingredient-${index}`));
    const { result } = renderHook(() => useOptionSetReferences('ingredient', entries, entries));

    expect(result.current.isReferenceAvailable('ingredient', 'ingredient-12', 'entry-12')).toBe(true);
    expect(result.current.isReferenceAvailable('ingredient', 'ingredient-29', 'entry-29')).toBe(true);
    expect(isOptionSetReferenceAvailable).not.toHaveBeenCalled();
  });

  it('requires a changed reference to be confirmed as active and available', () => {
    const original = [ingredientEntry('entry-1', 'ingredient-old')];
    const changed = [ingredientEntry('entry-1', 'ingredient-new')];
    const { result } = renderHook(() => useOptionSetReferences('ingredient', changed, original));

    expect(result.current.isReferenceAvailable('ingredient', 'ingredient-new', 'entry-1')).toBe(false);
    act(() => result.current.markReferenceVerified('ingredient', ingredientCandidate({ isActive: false })));
    expect(result.current.isReferenceAvailable('ingredient', 'ingredient-new', 'entry-1')).toBe(false);
    act(() => result.current.markReferenceVerified('ingredient', ingredientCandidate()));
    expect(result.current.isReferenceAvailable('ingredient', 'ingredient-new', 'entry-1')).toBe(true);
  });
});
