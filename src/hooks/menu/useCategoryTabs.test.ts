import { renderHook } from '@testing-library/react';
import { useCategoryTabs } from './useCategoryTabs';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';

// Mock t returns the key, so no translation "exists" — getCategoryDisplayName
// then falls back to the raw API category name (its documented behaviour).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const cat = (id: string, name: string) => ({ id, name }) as unknown as ApiCategory;

describe('useCategoryTabs', () => {
  const categories = [cat('c1', 'Grills'), cat('c2', 'Soups')];

  it('prepends All + Menu Bundles, then each category in order', () => {
    const { result } = renderHook(() => useCategoryTabs(categories, 'All'));
    expect(result.current.map((tab) => tab.id)).toEqual([ALL_ITEMS_KEY, MENU_BUNDLES_KEY, 'c1', 'c2']);
  });

  it('uses the provided all-label and the menu_bundles key for the fixed tabs', () => {
    const { result } = renderHook(() => useCategoryTabs(categories, 'Everything'));
    expect(result.current[0]).toEqual({ id: ALL_ITEMS_KEY, label: 'Everything' });
    expect(result.current[1]).toEqual({ id: MENU_BUNDLES_KEY, label: 'menu_bundles' });
  });

  it('labels categories via getCategoryDisplayName (falls back to the API name)', () => {
    const { result } = renderHook(() => useCategoryTabs(categories, 'All'));
    expect(result.current[2]).toEqual({ id: 'c1', label: 'Grills' });
    expect(result.current[3]).toEqual({ id: 'c2', label: 'Soups' });
  });

  it('returns just the two fixed tabs when there are no categories', () => {
    const { result } = renderHook(() => useCategoryTabs([], 'All'));
    expect(result.current).toHaveLength(2);
  });
});
