import { variationLabel } from './variationLabel';

describe('variationLabel', () => {
  it('prefers the reading language over English', () => {
    const item = {
      variationContent: { en: { name: 'Large' }, de: { name: 'Groß' } },
      variationName: 'Large (40 cm)',
    };
    expect(variationLabel(item, 'de')).toBe('Groß');
  });

  it('falls back to English when the reading language has no entry', () => {
    const item = { variationContent: { en: { name: 'Large' } }, variationName: 'Large (40 cm)' };
    expect(variationLabel(item, 'tr')).toBe('Large');
  });

  /**
   * The flat field is not a duplicate of the `en` entry: a variation typed by hand on the product
   * carries a name and NO translations at all, so this is the only thing such a line has. A
   * resolver that stopped at `variationContent` would show nothing for most of a real catalogue.
   */
  it('falls back to the flat name when there is no translated content at all', () => {
    expect(variationLabel({ variationName: 'Large (40 cm)' }, 'en')).toBe('Large (40 cm)');
  });

  it('ignores an empty translated name rather than rendering a blank label', () => {
    const item = { variationContent: { en: { name: '' }, de: { name: '' } }, variationName: 'Large (40 cm)' };
    expect(variationLabel(item, 'de')).toBe('Large (40 cm)');
  });

  it('is null — not an empty string — for a line with no variation', () => {
    expect(variationLabel({}, 'en')).toBeNull();
  });
});
