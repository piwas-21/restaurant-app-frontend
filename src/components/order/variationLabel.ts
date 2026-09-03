import type { BasketItemDto } from '@/types/basket';

/**
 * The variation a guest chose for one basket line, in the language they are reading.
 *
 * The resolution order is the one the /cart card and the checkout list already used, written once
 * because it was written twice: the localized `variationContent` for the active language, then its
 * English entry, then the flat `variationName` the backend also sends. The flat field is NOT a
 * duplicate of the `en` entry — a variation typed by hand carries a name and no translations at
 * all, so it is the only thing those lines have.
 *
 * `null` rather than `''` when the line has no variation: every caller renders conditionally, and a
 * falsy string invites `{label}` being drawn as an empty element.
 *
 * The language argument is the SHORT code (`i18n.language.split('-')[0]`). Callers pass it rather
 * than reading i18n here so this stays a pure function that a test can drive with a fixed locale.
 */
export function variationLabel(
  item: Pick<BasketItemDto, 'variationContent' | 'variationName'>,
  language: string,
): string | null {
  const localized = item.variationContent?.[language]?.name;
  const english = item.variationContent?.en?.name;
  return localized || english || item.variationName || null;
}
