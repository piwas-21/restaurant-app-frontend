import {
  buildTranslationSlots,
  everyLocaleProgress,
  isLocaleComplete,
  localeProgress,
  translationIn,
} from './translationSlots';

/**
 * The arithmetic behind the workbench's two counts, pinned without rendering anything.
 *
 * It matters that this is a PURE test: the completeness meter is the one part of the Translations
 * tab an admin will trust without checking, and the three UIs it replaces each counted a different
 * thing — one of them counted seeded blank entries as translations.
 */
const margherita = {
  name: 'Margherita Pizza',
  description: 'Classic tomato and mozzarella',
  content: [
    { language: 'fr', name: 'Pizza Margherita', description: 'Classique tomate et mozzarella' },
    { language: 'de', name: 'Margherita Pizza', description: '' },
  ],
  variations: [
    { name: 'Small', description: '', content: { fr: { name: '' } } },
    { name: 'Large', description: '32cm', content: { fr: { name: 'Grande', description: 'trente-deux cm' } } },
  ],
  ingredients: [
    { name: 'Mozzarella', content: { fr: { name: 'Mozzarella' } } },
    { name: 'Basil', content: {} },
  ],
};

describe('buildTranslationSlots — what there is to translate', () => {
  it('flattens the item, its variations and its ingredients into one list, in that order', () => {
    const slots = buildTranslationSlots(margherita);

    expect(slots.map((slot) => slot.key)).toEqual([
      'item-name',
      'item-description',
      'variation-0-name',
      'variation-1-name',
      'variation-1-description',
      'ingredient-0-name',
      'ingredient-1-name',
    ]);
    expect(slots.map((slot) => slot.group)).toEqual([
      'item',
      'item',
      'variations',
      'variations',
      'variations',
      'ingredients',
      'ingredients',
    ]);
  });

  // `variation-0-description` is absent above: the small pizza has no description, so there is
  // nothing to translate and an empty row would only be noise in the denominator.
  it('omits a field with neither a source string nor an existing translation', () => {
    const slots = buildTranslationSlots({ name: 'Water', description: '' });

    expect(slots.map((slot) => slot.key)).toEqual(['item-name']);
  });

  /**
   * The other half of that rule, and the one that is easy to get wrong: an existing translation
   * keeps its row ALIVE even when the source text has been cleared. Otherwise clearing an item's
   * description would hide ten translations of it from the only screen that can edit them, while
   * the PUT went on sending them — invisible, uncorrectable data.
   */
  it('keeps a row whose source is gone but whose translations are not', () => {
    const slots = buildTranslationSlots({
      name: 'Water',
      description: '',
      content: [{ language: 'fr', name: 'Eau', description: 'Eau plate' }],
    });

    expect(slots.map((slot) => slot.key)).toEqual(['item-name', 'item-description']);
    expect(translationIn(slots[1], 'fr')).toBe('Eau plate');
  });

  it('reads the product from an array of rows and a variation from a keyed map', () => {
    const slots = buildTranslationSlots(margherita);

    expect(translationIn(slots[0], 'fr')).toBe('Pizza Margherita');
    expect(translationIn(slots[4], 'fr')).toBe('trente-deux cm');
  });

  it('treats a blank or whitespace-only translation as absent', () => {
    const slots = buildTranslationSlots({
      name: 'Water',
      content: [
        { language: 'fr', name: '   ' },
        { language: 'de', name: 'Wasser' },
      ],
    });

    expect(translationIn(slots[0], 'fr')).toBe('');
    expect(translationIn(slots[0], 'de')).toBe('Wasser');
  });

  it('ignores a content row with no language, which the form can hold mid-edit', () => {
    const slots = buildTranslationSlots({ name: 'Water', content: [{ language: '', name: 'Eau' }] });

    expect(slots[0].translations).toEqual({});
  });
});

describe('completeness — the number the rail shows', () => {
  it('counts written strings against the slot count, which is the same for every locale', () => {
    const slots = buildTranslationSlots(margherita);

    expect(localeProgress(slots, 'fr')).toEqual({ done: 5, total: 7 });
    expect(localeProgress(slots, 'de')).toEqual({ done: 1, total: 7 });
    expect(localeProgress(slots, 'ru')).toEqual({ done: 0, total: 7 });
  });

  /**
   * `de` has a row — with a BLANK description — and it must not read as done. This is precisely the
   * defect the old ingredient UI shipped: it seeded blank entries for seven locales, so anything
   * counting keys rather than text would have called an untouched ingredient translated.
   */
  it('does not count a present-but-blank entry', () => {
    const slots = buildTranslationSlots(margherita);

    expect(isLocaleComplete(localeProgress(slots, 'de'))).toBe(false);
  });

  it('is complete only when every slot is written', () => {
    const slots = buildTranslationSlots({
      name: 'Water',
      content: [{ language: 'fr', name: 'Eau' }],
    });

    expect(isLocaleComplete(localeProgress(slots, 'fr'))).toBe(true);
  });

  // An item with nothing to translate is not "fully translated" — there is simply nothing to say.
  it('is not complete when there is nothing to translate', () => {
    expect(isLocaleComplete({ done: 0, total: 0 })).toBe(false);
  });

  it('reports all ten locales, so the rail never renders an undefined counter', () => {
    const progress = everyLocaleProgress(buildTranslationSlots(margherita));

    expect(Object.keys(progress).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'nl', 'ru', 'tr', 'zh']);
  });
});
