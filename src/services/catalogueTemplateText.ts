import type { LanguageCode } from '@/config/languageConfig';
import type { CatalogueTemplateRevision, CatalogueTemplateTranslation } from './catalogueTemplateService';

export function resolveCatalogueTemplateText(
  detail: CatalogueTemplateRevision,
  locale: LanguageCode,
): CatalogueTemplateTranslation {
  const candidates = [...new Set([locale, ...detail.localeFallbacks, detail.sourceLocale])];
  const translations = candidates.map((candidate) => detail.translations[candidate]);
  return {
    name: translations.find((translation) => translation?.name !== undefined)?.name ?? detail.name,
    description:
      translations.find((translation) => translation?.description !== undefined)?.description ??
      detail.description ??
      undefined,
  };
}
