export interface CategoryTranslation {
  name: string;
  description?: string | null;
}

/** Locale-keyed category text returned by and sent to the Categories API. */
export type CategoryTranslations = Record<string, CategoryTranslation>;

/** Drop blank fields created by the form's selected-but-unused target locale. */
export function omitNewBlankCategoryTranslations(
  translations: CategoryTranslations,
  original: CategoryTranslations = {},
): CategoryTranslations {
  return Object.fromEntries(
    Object.entries(translations).filter(([locale, entry]) => {
      if (Object.prototype.hasOwnProperty.call(original, locale)) return true;
      return entry.name.trim().length > 0 || Boolean(entry.description?.trim());
    }),
  );
}
