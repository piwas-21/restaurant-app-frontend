import {
  areOptionSetReferencesValid,
  areOptionSetVariationsValid,
  buildOptionSetWriteRequest,
  createEmptyOptionSetEntry,
  isValidOptionSetDraft,
  moveOptionSetEntry,
  optionSetLocaleOrDefault,
} from './optionSetEditorModel';

describe('optionSetEditorModel', () => {
  it('serializes only kind-valid defaults and preserves persisted entry IDs', () => {
    const entry = { ...createEmptyOptionSetEntry(0), id: 'entry-1', globalIngredientId: 'ingredient-1', name: 'Salt' };
    const request = buildOptionSetWriteRequest('ingredient', 'Salt choices', [entry]);
    expect(request).toEqual({
      kind: 'ingredient',
      name: 'Salt choices',
      sourceLocale: 'en',
      translations: { en: 'Salt choices' },
      entries: [
        {
          id: 'entry-1',
          name: 'Salt',
          displayOrder: 0,
          globalIngredientId: 'ingredient-1',
          isOptional: true,
          maxQuantity: 1,
          price: 0,
          isIncludedInBasePrice: false,
          isRequired: false,
          additionalPrice: 0,
          isDefault: false,
        },
      ],
    });
  });

  it('rejects duplicate canonical references and missing required values', () => {
    const first = { ...createEmptyOptionSetEntry(0), globalIngredientId: 'ingredient-1', name: 'Salt' };
    const second = { ...first, displayOrder: 1 };
    expect(isValidOptionSetDraft('ingredient', 'Seasoning', [first, second])).toBe(false);
    expect(isValidOptionSetDraft('ingredient', 'Seasoning', [{ ...first, name: ' ' }])).toBe(false);
    expect(isValidOptionSetDraft('ingredient', 'Seasoning', [first])).toBe(true);
  });

  it('moves choices without losing the persisted IDs or selected values', () => {
    const entries = [
      { ...createEmptyOptionSetEntry(0), id: 'a', productId: 'p-a', name: 'A' },
      { ...createEmptyOptionSetEntry(1), id: 'b', productId: 'p-b', name: 'B' },
    ];
    expect(moveOptionSetEntry(entries, 1, -1).map(({ id, displayOrder }) => [id, displayOrder])).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
  });

  it('validates persisted references and selected product variations by entry ID', () => {
    const entry = { ...createEmptyOptionSetEntry(0), id: 'entry-1', globalIngredientId: 'ingredient-1' };
    const isAvailable = jest.fn(() => true);

    expect(areOptionSetReferencesValid('ingredient', [entry], isAvailable)).toBe(true);
    expect(isAvailable).toHaveBeenCalledWith('ingredient', 'ingredient-1', 'entry-1');
    expect(areOptionSetReferencesValid('', [entry], isAvailable)).toBe(false);
    expect(areOptionSetVariationsValid([{ ...entry, productVariationId: 'variation-1' }], { 'entry-1': true })).toBe(
      true,
    );
    expect(areOptionSetVariationsValid([{ ...entry, productVariationId: 'variation-1' }], {})).toBe(false);
  });

  it('normalizes regional locales and falls back to English for unsupported locales', () => {
    expect(optionSetLocaleOrDefault('fr-CH')).toBe('fr');
    expect(optionSetLocaleOrDefault('unsupported')).toBe('en');
  });
});
