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
      'variation-index-0-name',
      'variation-index-1-name',
      'variation-index-1-description',
      'ingredient-index-0-name',
      'ingredient-index-1-name',
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

  it('keeps variation and ingredient slot identities attached through reorder and removal', () => {
    const original = buildTranslationSlots({
      variations: [
        { id: 'variation-small', name: 'Small' },
        { clientKey: 'draft-large', name: 'Large' }, // pragma: allowlist secret -- synthetic RHF row identity
      ],
      ingredients: [
        { id: 'ingredient-cheese', name: 'Cheese' },
        { id: 'ingredient-olives', name: 'Olives' },
      ],
    });
    const savedLocaleChoices = Object.fromEntries(
      original.map((slot) => [slot.key, slot.source === 'Small' ? 'fr' : 'de']),
    );

    const reordered = buildTranslationSlots({
      variations: [
        { clientKey: 'draft-large', name: 'Large' }, // pragma: allowlist secret -- synthetic RHF row identity
        { id: 'variation-small', name: 'Small' },
      ],
      ingredients: [
        { id: 'ingredient-olives', name: 'Olives' },
        { id: 'ingredient-cheese', name: 'Cheese' },
      ],
    });
    const afterRemoval = buildTranslationSlots({
      variations: [{ id: 'variation-small', name: 'Small' }],
      ingredients: [{ id: 'ingredient-cheese', name: 'Cheese' }],
    });

    for (const source of ['Small', 'Large', 'Cheese', 'Olives']) {
      const before = original.find((slot) => slot.source === source);
      const afterMove = reordered.find((slot) => slot.source === source);
      expect(afterMove?.key).toBe(before?.key);
      expect(savedLocaleChoices[afterMove!.key]).toBe(source === 'Small' ? 'fr' : 'de');
    }
    expect(afterRemoval.map((slot) => slot.key)).toEqual([
      'variation-id-variation-small-name',
      'ingredient-ingredient-cheese-name',
    ]);
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

  it('includes bundle step names and descriptions with their existing locale text', () => {
    const slots = buildTranslationSlots({
      sections: [
        {
          id: 'section-drink',
          name: 'Choose a drink',
          description: 'Select one cold drink',
          translations: {
            fr: { name: 'Choisissez une boisson', description: 'Choisissez une boisson fraîche' },
            ar: { name: 'اختر مشروبًا', description: null },
          },
        },
      ],
    });

    expect(slots.map((slot) => slot.key)).toEqual([
      'menu-section-section-drink-name',
      'menu-section-section-drink-description',
    ]);
    expect(slots[0].ref).toEqual({ target: 'menuSection', index: 0, field: 'name' });
    expect(translationIn(slots[0], 'fr')).toBe('Choisissez une boisson');
    expect(translationIn(slots[1], 'fr')).toBe('Choisissez une boisson fraîche');
    expect(translationIn(slots[1], 'ar')).toBe('');
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

describe('a sauce is filed under Sauces, not Ingredients (#588 split one array into two sections)', () => {
  /**
   * `detailedIngredients` is ONE array holding both kinds; #588 gave it two named sections on the
   * Item tab and kept one store behind them. The workbench must group the same way or it sends the
   * admin to a section the row is not in.
   *
   * This is the assertion a conflict-free rebase could not have produced. Nothing failed to compile
   * when #588 landed, the build was green, and every write still went to the right row — the slot's
   * `ref` addresses the whole array by index and was never wrong. Only the LABEL was.
   */
  const withSauce = {
    name: 'Margherita Pizza',
    ingredients: [
      { name: 'Mozzarella', content: {} },
      { name: 'Garlic mayo', kind: 'sauce', content: {} },
      { name: 'Basil', content: {} },
    ],
  };

  it('groups by kind while still addressing the ONE array by absolute index', () => {
    const slots = buildTranslationSlots(withSauce);

    expect(slots.map((slot) => [slot.source, slot.group])).toEqual([
      ['Margherita Pizza', 'item'],
      ['Mozzarella', 'ingredients'],
      ['Garlic mayo', 'sauces'],
      ['Basil', 'ingredients'],
    ]);
    // The sauce is row 1 of the product's array, not row 0 of a "sauces" array. Writing to a
    // group-relative index would silently rename Mozzarella.
    expect(slots[2].ref).toEqual({ target: 'ingredient', index: 1 });
    expect(slots[3].ref).toEqual({ target: 'ingredient', index: 2 });
  });

  // `kind` is additive and absent on every row that predates it (D8), so the default is load-bearing.
  it('files a row with no kind under Ingredients rather than dropping it', () => {
    const slots = buildTranslationSlots({ ingredients: [{ name: 'Olives' }] });

    expect(slots.map((slot) => slot.group)).toEqual(['ingredients']);
  });

  // Completeness counts every translatable string on the item, both kinds together.
  it('counts a sauce toward the item denominator like any other row', () => {
    expect(localeProgress(buildTranslationSlots(withSauce), 'fr').total).toBe(4);
  });
});
