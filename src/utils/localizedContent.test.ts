import { localizedDescription, localizedMenuSection, localizedName } from './localizedContent';
import { isFixedPlatSection } from './fixedPlatSection';

const item = {
  name: 'Pizza',
  description: 'Wood-fired, 48h dough',
  content: {
    tr: { name: 'Pizza TR', description: 'Odun ateşinde' },
    en: { name: 'Pizza EN', description: 'Wood-fired' },
  },
};

describe('localizedName', () => {
  it("prefers the requested locale's row", () => {
    expect(localizedName(item, 'tr')).toBe('Pizza TR');
  });

  it('falls back to English, then to the plain name', () => {
    expect(localizedName(item, 'de')).toBe('Pizza EN');
    expect(localizedName({ name: 'Pizza' }, 'de')).toBe('Pizza');
  });
});

describe('localizedDescription', () => {
  it("prefers the requested locale's row", () => {
    expect(localizedDescription(item, 'tr')).toBe('Odun ateşinde');
  });

  it('falls back to English', () => {
    expect(localizedDescription(item, 'de')).toBe('Wood-fired');
  });

  it('falls back to the plain description when no translation carries one (F3)', () => {
    const untranslated = { name: 'Pizza', description: 'Wood-fired, 48h dough', content: { en: { name: 'Pizza EN' } } };
    expect(localizedDescription(untranslated, 'tr')).toBe('Wood-fired, 48h dough');
  });

  it('is undefined when the item has no description at all', () => {
    expect(localizedDescription({ name: 'Pizza' }, 'en')).toBeUndefined();
  });
});

describe('localizedMenuSection', () => {
  const section = {
    id: 'stable-section-id',
    name: 'Choose a dish',
    description: 'Choose one dish',
    translations: {
      en: { name: 'Choose a dish', description: 'Choose one dish' },
      fr: { name: 'Choisissez un plat', description: 'Choisissez votre plat' },
      ar: { name: 'اختر طبقًا', description: 'اختر طبقًا واحدًا' },
    },
    displayOrder: 0,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [
      {
        id: 'stable-item-id',
        productId: 'product',
        productName: 'Taco',
        additionalPrice: 0,
        displayOrder: 0,
        isDefault: true,
      },
    ],
  };

  it.each([
    ['fr', 'Choisissez un plat', 'Choisissez votre plat'],
    ['en', 'Choose a dish', 'Choose one dish'],
    ['ar', 'اختر طبقًا', 'اختر طبقًا واحدًا'],
  ])('resolves %s screen copy without changing stable IDs', (language, name, description) => {
    const localized = localizedMenuSection(section, language);

    expect(localized).toMatchObject({ id: 'stable-section-id', name, description });
    expect(localized.items[0].id).toBe('stable-item-id');
  });

  it('falls back to English when the current locale has no section translation', () => {
    expect(localizedMenuSection(section, 'de').name).toBe('Choose a dish');
  });

  it('keeps fixed-Plat detection tied to the authored name after translating the display name', () => {
    const fixedPlat = localizedMenuSection({ ...section, name: 'Plat', translations: { en: { name: 'Dish' } } }, 'en');
    const translatedPlat = localizedMenuSection(
      { ...section, name: 'Main', translations: { fr: { name: 'Plat' } } },
      'fr',
    );

    expect(fixedPlat.name).toBe('Dish');
    expect(isFixedPlatSection(fixedPlat)).toBe(true);
    expect(isFixedPlatSection(translatedPlat)).toBe(false);
  });
});
