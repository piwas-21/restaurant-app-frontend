import type { LanguageCode } from '@/config/languageConfig';
import type { CatalogueTemplateRevision } from './catalogueTemplateService';
import { resolveCatalogueSectionName } from './catalogueTemplateText';

const detail: Pick<CatalogueTemplateRevision, 'sourceLocale' | 'localeFallbacks'> = {
  sourceLocale: 'tr',
  localeFallbacks: ['fr', 'en'] as LanguageCode[],
};

describe('resolveCatalogueSectionName', () => {
  it('uses exact locale, then the template fallback sequence, then source name', () => {
    const section = {
      name: 'Ana yemek',
      translations: { fr: { name: 'Plat principal' }, en: { name: 'Main course' } },
    };
    expect(resolveCatalogueSectionName(section, detail, 'fr')).toBe('Plat principal');
    expect(resolveCatalogueSectionName(section, detail, 'de')).toBe('Plat principal');
    expect(resolveCatalogueSectionName({ ...section, translations: {} }, detail, 'de')).toBe('Ana yemek');
  });

  it('skips blank reviewed values and keeps source text as an explicit fallback', () => {
    const section = { name: 'Ana yemek', translations: { de: { name: '   ' }, en: { name: 'Main course' } } };
    expect(resolveCatalogueSectionName(section, detail, 'de')).toBe('Main course');
  });
});
