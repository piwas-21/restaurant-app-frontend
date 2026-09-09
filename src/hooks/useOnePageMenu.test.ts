import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';
import { useOnePageMenu, onePageSectionId } from './useOnePageMenu';
import type { ApiCategory } from '@/types/menu';

/**
 * The one-page layout's data controller. What is pinned:
 *  - a fetch PER CATEGORY carrying the guest's channel (the tabs pipeline is stood down
 *    here, so nothing else would resolve per-row availability verdicts);
 *  - the bundles fetched once for their own section;
 *  - `enabled = false` (tabs layout owns the page) fetches NOTHING;
 *  - a nav click records the active tab and scrolls the section under the sticky bar —
 *    with the sticky offset left to `scroll-margin-top`, not to JS arithmetic.
 */
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ getPublicMenuBundles: jest.fn() }));
jest.mock('@/hooks/publicMenu/usePublicMenuCategories', () => ({
  usePublicMenuCategories: jest.fn(),
}));

import { usePublicMenuCategories } from '@/hooks/publicMenu/usePublicMenuCategories';

const mockOrderType = useOrderType as jest.Mock;
const mockGetProducts = getProducts as jest.Mock;
const mockGetBundles = getPublicMenuBundles as jest.Mock;
const mockCategories = usePublicMenuCategories as jest.Mock;

const CATEGORIES: ApiCategory[] = [
  { id: 'cat-starters', name: 'Starters' },
  { id: 'cat-mains', name: 'Grills' },
];

function setContext(orderType: null, hydrated = true) {
  mockOrderType.mockReturnValue({ state: { orderType }, hydrated });
}

beforeEach(() => {
  jest.clearAllMocks();
  setContext(null);
  mockCategories.mockReturnValue(CATEGORIES);
  mockGetProducts.mockImplementation((_page, _size, categoryId: string) =>
    Promise.resolve({
      success: true,
      data: { items: [{ id: `prod-${categoryId}`, name: 'K', basePrice: 5 }], totalPages: 1, totalCount: 1 },
    }),
  );
  mockGetBundles.mockResolvedValue({
    success: true,
    data: { items: [{ id: 'bundle-1', name: 'Combo', basePrice: 12 }], totalPages: 1, totalCount: 1 },
  });
});

describe('useOnePageMenu — data', () => {
  it('fetches page 1 of EVERY category plus the bundles, carrying the channel', async () => {
    const { result } = renderHook(() => useOnePageMenu(true));

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(2));
    expect(mockGetProducts).toHaveBeenCalledWith(1, expect.any(Number), 'cat-starters', undefined, null, true);
    expect(mockGetProducts).toHaveBeenCalledWith(1, expect.any(Number), 'cat-mains', undefined, null, true);
    expect(mockGetBundles).toHaveBeenCalledWith(1, expect.any(Number), null);

    await waitFor(() => expect(result.current.sections[1].state.items).toHaveLength(1));
    // Products keep their category for the section they render in.
    expect(result.current.sections[1].state.items[0].categoryKey).toBe('cat-mains');
    expect(result.current.menuBundles).toHaveLength(1);
    // Sections come out in nav order with their per-category state.
    expect(result.current.sections.map((s) => s.category.id)).toEqual(['cat-starters', 'cat-mains']);
  });

  it('fetches nothing when disabled — the tabs layout owns the page', async () => {
    renderHook(() => useOnePageMenu(false));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetProducts).not.toHaveBeenCalled();
    expect(mockGetBundles).not.toHaveBeenCalled();
  });

  it('refetches a single category on retry, not the whole page', async () => {
    const { result } = renderHook(() => useOnePageMenu(true));
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(2));

    await act(async () => {
      result.current.refetchCategory('cat-mains');
    });
    expect(mockGetProducts).toHaveBeenCalledTimes(3);
    expect(mockGetProducts.mock.calls[2][2]).toBe('cat-mains');
    expect(mockGetBundles).toHaveBeenCalledTimes(1);
  });
});

describe('useOnePageMenu — jump to section', () => {
  it('records the clicked tab and scrolls its element; All scrolls back to the top', () => {
    const scrollTo = jest.fn();
    const scrollIntoView = jest.fn();
    window.scrollTo = scrollTo;
    const anchors: Record<string, { id: string; scrollIntoView: typeof scrollIntoView }> = {
      [onePageSectionId('cat-mains')]: { id: 'cat-mains', scrollIntoView },
    };
    jest.spyOn(document, 'getElementById').mockImplementation((id) => (anchors[id] as unknown as HTMLElement) ?? null);

    const { result } = renderHook(() => useOnePageMenu(true));

    act(() => {
      result.current.selectSection('cat-mains');
    });
    expect(result.current.activeSectionId).toBe('cat-mains');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    // No offset arithmetic in JS — the CSS scroll-margin carries the sticky heights.
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => {
      result.current.selectSection('all');
    });
    expect(result.current.activeSectionId).toBe('all');
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    // The bundles tab has its own anchor id spelling, shared with the renderer.
    expect(onePageSectionId('menu-bundles')).toBe('menu-section-menu-bundles');
  });
});
