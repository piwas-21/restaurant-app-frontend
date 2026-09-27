import { optionSetEditorSchema } from './optionSetEditorSchema';

const validSauceSet = {
  kind: 'sauce',
  name: 'Garlic sauce',
  sourceLocale: 'fr',
  entries: [
    {
      name: 'Aioli',
      globalIngredientId: 'ingredient-1',
      price: 0,
      maxQuantity: 1,
      additionalPrice: 0,
    },
  ],
};

describe('optionSetEditorSchema', () => {
  it('accepts complete, kind-matched option set forms', () => {
    expect(optionSetEditorSchema.safeParse(validSauceSet).success).toBe(true);
  });

  it('rejects missing source text, empty entries, and invalid canonical references', () => {
    expect(optionSetEditorSchema.safeParse({ ...validSauceSet, name: ' ' }).success).toBe(false);
    expect(optionSetEditorSchema.safeParse({ ...validSauceSet, entries: [] }).success).toBe(false);
    expect(
      optionSetEditorSchema.safeParse({
        ...validSauceSet,
        entries: [{ ...validSauceSet.entries[0], globalIngredientId: undefined }],
      }).success,
    ).toBe(false);
  });

  it('rejects repeated canonical references', () => {
    expect(
      optionSetEditorSchema.safeParse({
        ...validSauceSet,
        entries: [validSauceSet.entries[0], { ...validSauceSet.entries[0], name: 'Second' }],
      }).success,
    ).toBe(false);
  });
});
