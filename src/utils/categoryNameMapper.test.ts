import {
  getLocalizedCategoryDescription,
  getLocalizedCategoryName,
  getSelectedViewDescription,
  getSelectedViewLabel,
} from './categoryNameMapper';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';

/**
 * `getSelectedViewLabel` was lifted out of `app/menu/page.tsx` by S11, because the page had reached
 * its 200-LOC ceiling. It arrived with no coverage at all: no test renders `MenuPage` (the two
 * placement suites read the file as TEXT), so nothing executed it, and `src/utils/**` falls through
 * `check-file-length.sh`'s catch-all so no gate looked at it either.
 *
 * Only the `ALL_ITEMS_KEY` branch is exercised by the screenshot baselines — they capture the
 * default view — so the bundles branch and the id-fallback are what these cases exist for.
 */
const t = (key: string) => key;

const categories = [
  { id: 'cat-1', name: 'Grills' },
  { id: 'cat-2', name: 'Desserts' },
] as unknown as ApiCategory[];

describe('getSelectedViewLabel', () => {
  it('names the all-items view from the translation table', () => {
    expect(getSelectedViewLabel(ALL_ITEMS_KEY, categories, t)).toBe('all_categories_nav');
  });

  it('names the bundles view from the translation table', () => {
    expect(getSelectedViewLabel(MENU_BUNDLES_KEY, categories, t)).toBe('menu_bundles');
  });

  it('does not confuse the two sentinels', () => {
    // Swapping the branches is the cheapest possible regression here and the only thing that
    // catches it is asserting both, in one place.
    expect(getSelectedViewLabel(ALL_ITEMS_KEY, categories, t)).not.toBe(
      getSelectedViewLabel(MENU_BUNDLES_KEY, categories, t),
    );
  });

  it('resolves a real category to its display name', () => {
    expect(getSelectedViewLabel('cat-1', categories, t)).toBe('Grills');
  });

  it('prefers an exact or base-locale category translation before built-in and base text', () => {
    const category: ApiCategory = {
      id: 'cat-3',
      name: 'Grills',
      translations: { fr: { name: 'Grillades' } },
    };

    expect(getLocalizedCategoryName(category, 'fr-CH', t)).toBe('Grillades');
    expect(
      getLocalizedCategoryName({ ...category, translations: { 'fr-CH': { name: 'Grillades CH' } } }, 'fr-CH', t),
    ).toBe('Grillades CH');
    expect(
      getLocalizedCategoryName(
        { ...category, translations: { 'fr-CH': { name: '' }, fr: { name: 'Grillades' } } },
        'fr-CH',
        t,
      ),
    ).toBe('Grillades');
  });

  it('uses built-in i18next text after a missing locale translation, then the base name', () => {
    const category: ApiCategory = { id: 'cat-3', name: 'Grills' };

    expect(getLocalizedCategoryName(category, 'de', (key) => (key === 'grill' ? 'Grillgerichte' : key))).toBe(
      'Grillgerichte',
    );
    expect(getLocalizedCategoryName(category, 'de', t)).toBe('Grills');
  });

  it('uses the localized description when present and otherwise preserves the base description', () => {
    const category: ApiCategory = {
      id: 'cat-3',
      name: 'Grills',
      description: 'Base description',
      translations: { fr: { name: 'Grillades', description: 'Description française' } },
    };

    expect(getLocalizedCategoryDescription(category, 'fr-CH')).toBe('Description française');
    expect(getLocalizedCategoryDescription(category, 'de')).toBe('Base description');
    expect(getSelectedViewDescription('cat-3', [category], 'fr-CH')).toBe('Description française');
  });

  it('falls back to the id when the category is not in the list, rather than rendering nothing', () => {
    // An empty <h2> is the failure this guards: the heading is the section's `aria-labelledby`
    // target, so a blank one costs the grid its accessible name as well as its visible one.
    expect(getSelectedViewLabel('cat-missing', categories, t)).toBe('cat-missing');
    expect(getSelectedViewLabel('cat-1', [], t)).toBe('cat-1');
  });
});
