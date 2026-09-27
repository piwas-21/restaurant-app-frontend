import {
  buildOptionSetWriteRequest,
  createEmptyOptionSetEntry,
  isValidOptionSetDraft,
  moveOptionSetEntry,
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
});
