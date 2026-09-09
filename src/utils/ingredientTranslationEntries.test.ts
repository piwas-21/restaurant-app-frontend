import {
  buildIngredientEntries,
  translationsForSave,
  type IngredientCarrierProduct,
} from './ingredientTranslationEntries';
import type { ProductIngredient } from '@/types/menu';

/**
 * The folding of per-product ingredient copies into one editable entry — the model the partner
 * complaint stands on ("fixed one product, the others kept the old name"). What is pinned here is
 * the GROUPING (id, then folded name), the CONSENSUS arithmetic (value / disagreements / missing)
 * and the save payload rule (blank locale means leave alone).
 */

const copy = (overrides: Partial<ProductIngredient> & { id: string; name: string }): ProductIngredient => ({
  isOptional: true,
  price: 0,
  isActive: true,
  displayOrder: 1,
  ...overrides,
});

const product = (id: string, name: string, ingredients: ProductIngredient[]): IngredientCarrierProduct => ({
  id,
  name,
  detailedIngredients: ingredients,
});

describe('buildIngredientEntries — the grouping', () => {
  it('folds copies that share a globalIngredientId into ONE entry across products', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Chicken Burger', [
        copy({ id: 'i1', name: 'Sans Sauces', kind: 'sauce', globalIngredientId: 'g1' }),
      ]),
      product('p2', 'Tower Burger', [copy({ id: 'i2', name: 'Sans Sauces', kind: 'sauce', globalIngredientId: 'g1' })]),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].globalIngredientId).toBe('g1');
    expect(entries[0].copies.map((c) => c.productId)).toEqual(['p1', 'p2']);
  });

  it('groups legacy copies by the DIACRITIC-FOLDED name when no copy carries provenance', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Dish', [copy({ id: 'i1', name: 'Crème fraîche' })]),
      product('p2', 'Other', [copy({ id: 'i2', name: 'CREME FRAICHE' })]),
      product('p3', 'Third', [copy({ id: 'i3', name: 'Something else' })]),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.defaultName === 'Crème fraîche')?.copies).toHaveLength(2);
  });

  it('ADOPTS the id for a part-migrated group: a name-founded group gains provenance', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Dish', [copy({ id: 'i1', name: 'Garlic sauce' })]),
      product('p2', 'Other', [copy({ id: 'i2', name: 'Garlic sauce', globalIngredientId: 'g9' })]),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].globalIngredientId).toBe('g9');
  });

  it('marks a group sauce when ANY copy resolves as a sauce', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Dish', [copy({ id: 'i1', name: 'House sauce' })]),
      product('p2', 'Other', [copy({ id: 'i2', name: 'House sauce', kind: 'sauce' })]),
    ]);

    expect(entries[0].isSauce).toBe(true);
  });

  it('sorts sauces before ingredients, then alphabetically, folding accents', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Dish', [
        copy({ id: 'b', name: 'Bologna' }),
        copy({ id: 'a', name: 'BBQ Sauce', kind: 'sauce' }),
        copy({ id: 'c', name: 'Crème' }),
      ]),
    ]);

    expect(entries.map((e) => e.defaultName)).toEqual(['BBQ Sauce', 'Bologna', 'Crème']);
  });
});

describe('buildIngredientEntries — the per-locale consensus cells', () => {
  const mcdoner = () =>
    buildIngredientEntries([
      product('p1', 'Chicken Burger', [
        copy({
          id: 'i1',
          name: 'Sans Sauces',
          kind: 'sauce',
          globalIngredientId: 'g1',
          content: { en: { name: 'No sauce' }, tr: { name: 'Sos istemiyorum' } },
        }),
      ]),
      product('p2', 'Tower Burger', [
        copy({
          id: 'i2',
          name: 'Sans Sauces',
          kind: 'sauce',
          globalIngredientId: 'g1',
          content: { en: { name: 'No sauce' }, fr: { name: 'Sans sauce' } },
        }),
      ]),
    ]);

  it('reports consensus where copies agree, and the first reading as the value', () => {
    const [entry] = mcdoner();

    expect(entry.cells.en).toEqual({ value: 'No sauce', disagreements: 0, missing: 0 });
  });

  it('reports MISSING exactly like the partner saw it: fr exists on one copy only', () => {
    const [entry] = mcdoner();

    expect(entry.cells.fr).toEqual({ value: 'Sans sauce', disagreements: 0, missing: 1 });
    expect(entry.cells.tr).toEqual({ value: 'Sos istemiyorum', disagreements: 0, missing: 1 });
  });

  it('reports a DISAGREEMENT when copies carry different non-blank names, value = first copy', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Dish', [copy({ id: 'i1', name: 'X', content: { en: { name: 'Ketchup' } } })]),
      product('p2', 'Other', [copy({ id: 'i2', name: 'X', content: { en: { name: 'Catchup' } } })]),
    ]);

    expect(entries[0].cells.en).toEqual({ value: 'Ketchup', disagreements: 1, missing: 0 });
  });

  it('ignores blank and whitespace-only readings, which are absence, not a name', () => {
    const entries = buildIngredientEntries([
      product('p1', 'Dish', [copy({ id: 'i1', name: 'X', content: { en: { name: '   ' } } })]),
      product('p2', 'Other', [copy({ id: 'i2', name: 'X', content: { en: { name: 'Ketchup' } } })]),
    ]);

    expect(entries[0].cells.en).toEqual({ value: 'Ketchup', disagreements: 0, missing: 1 });
  });
});

describe('translationsForSave — the payload rule', () => {
  const entry = buildIngredientEntries([
    product('p1', 'Dish', [
      copy({ id: 'i1', name: 'X', content: { en: { name: 'Ketchup' }, fr: { name: 'Ketchup' } } }),
    ]),
  ])[0];

  it('sends the consensus value for every locale the admin left untouched', () => {
    expect(translationsForSave(entry, {})).toEqual([
      { languageCode: 'en', name: 'Ketchup' },
      { languageCode: 'fr', name: 'Ketchup' },
    ]);
  });

  it('prefers the admin edit per locale', () => {
    expect(translationsForSave(entry, { fr: 'Le ketchup' })).toEqual([
      { languageCode: 'en', name: 'Ketchup' },
      { languageCode: 'fr', name: 'Le ketchup' },
    ]);
  });

  it('drops locales whose (edited) value is blank — blank means leave alone, never erase', () => {
    expect(translationsForSave(entry, { en: '' })).toEqual([{ languageCode: 'fr', name: 'Ketchup' }]);
  });
});
