import { nextProductContent, withIngredientTranslation } from './translationWrites';

/**
 * The product's translations are an ARRAY of `{language, name, description}` rows, and
 * `contentSchema.name` is `min(1)`. Those two facts together are why writing one locale's name is
 * not a `setValue` on a path: a row has to be created on demand and destroyed when it empties, or
 * an admin who clears a field is left with a Save button that silently refuses.
 */
describe('nextProductContent', () => {
  const rows = [
    { language: 'fr', name: 'Pizza Margherita', description: 'Classique' },
    { language: 'de', name: 'Margherita Pizza', description: '' },
  ];

  it('updates the row a locale already has, in place', () => {
    expect(nextProductContent(rows, 'de', 'name', 'Margherita-Pizza')).toEqual([
      { language: 'fr', name: 'Pizza Margherita', description: 'Classique' },
      { language: 'de', name: 'Margherita-Pizza', description: '' },
    ]);
  });

  it('creates the row for a locale that has none, with the other field blank', () => {
    expect(nextProductContent(rows, 'nl', 'name', 'Margherita')).toEqual([
      ...rows,
      { language: 'nl', name: 'Margherita', description: '' },
    ]);
  });

  /**
   * Order is not cosmetic: the resolver reports `errors.content[i].name` by INDEX, so shuffling
   * these rows would move a message onto another language's field.
   */
  it('preserves the order of the rows it did not touch', () => {
    const next = nextProductContent(rows, 'fr', 'description', 'Classique tomate');

    expect(next.map((row) => row.language)).toEqual(['fr', 'de']);
  });

  it('drops a row once both of its fields are blank', () => {
    const next = nextProductContent(rows, 'de', 'name', '');

    expect(next.map((row) => row.language)).toEqual(['fr']);
  });

  /**
   * A description with no name is text the admin really typed. It is kept, the resolver names it
   * ("Name is required for this language"), and the workbench renders that message under the name
   * it belongs to — deleting the work to make the message go away would be worse than the message.
   */
  it('keeps a row that still has a description but no name', () => {
    const next = nextProductContent([{ language: 'it', name: 'Margherita', description: '' }], 'it', 'name', '');

    expect(next).toEqual([]);

    const withDescription = nextProductContent(
      [{ language: 'it', name: 'Margherita', description: 'Pomodoro' }],
      'it',
      'name',
      '',
    );
    expect(withDescription).toEqual([{ language: 'it', name: '', description: 'Pomodoro' }]);
  });

  it('never mutates the rows it was given', () => {
    const original = JSON.parse(JSON.stringify(rows));

    nextProductContent(rows, 'de', 'name', 'changed');

    expect(rows).toEqual(original);
  });
});

describe('withIngredientTranslation', () => {
  it('adds a locale without disturbing the ones already there', () => {
    const ingredient = { name: 'Mozzarella', content: { fr: { name: 'Mozzarelle' } } };

    const next = withIngredientTranslation(ingredient, 'nl', 'Mozzarella');

    expect(next.content).toEqual({ fr: { name: 'Mozzarelle' }, nl: { name: 'Mozzarella' } });
    expect(ingredient.content).toEqual({ fr: { name: 'Mozzarelle' } });
  });

  // An ingredient added today has `content: {}` — S4 deleted the seven-of-ten seed — so the first
  // write is always into an empty map.
  it('starts a content map that does not exist yet', () => {
    const basil: { name: string; content?: Record<string, { name: string; description?: string }> } = {
      name: 'Basil',
    };

    expect(withIngredientTranslation(basil, 'ru', 'Базилик').content).toEqual({ ru: { name: 'Базилик' } });
  });

  it('keeps a description the library supplied while replacing the name', () => {
    const ingredient = { name: 'Basil', content: { fr: { name: 'Basilic', description: 'frais' } } };

    expect(withIngredientTranslation(ingredient, 'fr', 'Basilic thaï').content?.fr).toEqual({
      name: 'Basilic thaï',
      description: 'frais',
    });
  });
});
