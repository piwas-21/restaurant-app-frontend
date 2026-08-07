import type { ApiCategory } from '@/types/menu';
// A pure constants module (two string literals, no React), so reaching into `hooks/` from here
// costs nothing at runtime and keeps the two sentinels spelled in exactly one place.
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';

/**
 * Maps API category names to translation keys
 * Used for localizing category names from the backend
 */
export function mapCategoryNameToTranslationKey(apiCategoryName: string): string {
  const mapping: Record<string, string> = {
    Starters: 'starters',
    Grills: 'grill',
    Grill: 'grill',
    Dessert: 'dessert',
    Desserts: 'dessert',
    'Dürüm Wraps': 'durum',
    'Durum Wraps': 'durum',
    'Hot Drinks': 'hotDrink',
    'Cold Drinks': 'coldDrink',
    Drinks: 'hotDrink',
    Pizza: 'pizza',
    Pide: 'pide',
    'Turkish Specialties': 'turkishSpecialty',
    'Oriental Specialties': 'orientalSpecialty',
    'Special of the Day': 'specialOfTheDay',
    Soups: 'soups',
  };

  return mapping[apiCategoryName] || apiCategoryName.toLowerCase();
}

/**
 * Gets the display name for a category
 * Returns translated name if available, otherwise returns API name
 */
export function getCategoryDisplayName(categoryName: string, translationFunction: (key: string) => string): string {
  const translationKey = mapCategoryNameToTranslationKey(categoryName);
  const translatedName = translationFunction(translationKey);

  // If translation exists and is different from the key, use it; otherwise use API name
  return translatedName !== translationKey ? translatedName : categoryName;
}

/**
 * The heading for a selected menu view.
 *
 * `ALL_ITEMS_KEY` and `MENU_BUNDLES_KEY` are sentinels, not category ids, so there is no API name to
 * map for either — each carries its own label. An id with no matching category falls back to the id
 * itself rather than to an empty heading. Lifted out of the menu page verbatim: the page renders it,
 * it is not page state, and `page.tsx` is at its 200-LOC ceiling.
 */
export function getSelectedViewLabel(
  selectedView: string,
  categories: ApiCategory[],
  translationFunction: (key: string) => string,
): string {
  if (selectedView === ALL_ITEMS_KEY) return translationFunction('all_categories_nav');
  if (selectedView === MENU_BUNDLES_KEY) return translationFunction('menu_bundles');

  const category = categories.find((c) => c.id === selectedView);
  return category ? getCategoryDisplayName(category.name, translationFunction) : selectedView;
}
