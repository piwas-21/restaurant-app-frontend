import { localizedDescription, localizedName } from './localizedContent';

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
