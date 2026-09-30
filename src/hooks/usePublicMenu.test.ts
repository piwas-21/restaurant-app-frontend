import { renderHook, act, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { usePublicMenu, MENU_BUNDLES_KEY } from './usePublicMenu';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';
import type { ApiCategory } from '@/types/menu';
import type { PublicMenuClientData } from '@/types/publicDiscovery';

/**
 * The seam the whole S4 slice rests on: the guest's channel actually reaching `GET /api/Products`.
 *
 * Everything else is covered a layer away — `menuService.test.ts` pins the query string and the card
 * tests pin the render — but nothing joined them, so dropping the argument here (or letting
 * `hydrated` never flip) would silently lose the channel with every other assertion still green.
 */
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/services/menuService', () => ({
  getProducts: jest.fn(),
}));
jest.mock('@/services/menuBundleService', () => ({
  getPublicMenuBundles: jest.fn(),
}));
let mockCategories: ApiCategory[] = [];
jest.mock('./publicMenu/usePublicMenuCategories', () => ({
  usePublicMenuCategories: () => mockCategories,
}));

const mockOrderType = useOrderType as jest.Mock;
const mockGetProducts = getProducts as jest.Mock;
const mockGetBundles = getPublicMenuBundles as jest.Mock;

/** The channel `getProducts` was called with — its 5th positional argument. */
function channelOfCall(index = 0): OrderType | null | undefined {
  return mockGetProducts.mock.calls[index]?.[4];
}

function setOrderTypeContext(orderType: OrderType | null, hydrated: boolean) {
  mockOrderType.mockReturnValue({ state: { orderType }, hydrated });
}

function menuSnapshot(categories: ApiCategory[], categoriesComplete: boolean): PublicMenuClientData {
  return {
    locale: 'fr',
    categories,
    categoriesComplete,
    products: { currentPage: 3, totalPages: 3, totalCount: 205, pageSize: 200, items: [] },
    bundles: { currentPage: 1, totalPages: 1, totalCount: 0, pageSize: 200, items: [] },
    productsByCategory: {},
    offerFamilies: [],
    offerPage: { currentPage: 3, totalPages: 3, totalCount: 205, pageSize: 100 },
    restaurantInfo: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCategories = [];
  mockGetProducts.mockResolvedValue({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
  mockGetBundles.mockResolvedValue({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
});

describe('usePublicMenu — disabled item pipelines retain catalogue navigation', () => {
  it('reconciles stale server view props from the filtered URL on mount without resetting its page', () => {
    setOrderTypeContext(null, false);
    window.history.replaceState({}, '', '/fr/menu?page=3&categoryId=cat-tacos');
    const historyLength = window.history.length;
    const snapshot = menuSnapshot([{ id: 'cat-tacos', name: 'Tacos' }], true);

    const { result, unmount } = renderHook(() => usePublicMenu(false, snapshot, 'all', true));
    try {
      expect(result.current.selectedView).toBe('cat-tacos');
      expect(window.location.pathname).toBe('/fr/menu');
      expect(new URLSearchParams(window.location.search).toString()).toBe('page=3&categoryId=cat-tacos');
      expect(window.history.length).toBe(historyLength);
    } finally {
      unmount();
      window.history.replaceState({}, '', '/');
    }
  });

  it('accepts a valid URL category while the server category snapshot is incomplete', () => {
    setOrderTypeContext(null, false);
    window.history.replaceState({}, '', '/fr/menu?page=3&categoryId=cat-pending');

    const { result, unmount } = renderHook(() => usePublicMenu(false, menuSnapshot([], false), 'all', true));
    try {
      expect(result.current.selectedView).toBe('cat-pending');
    } finally {
      unmount();
      window.history.replaceState({}, '', '/');
    }
  });

  it.each([
    ['/fr/menu?page=3&categoryId=cat%2Ftacos', [{ id: 'cat-tacos', name: 'Tacos' }], true],
    ['/fr/menu?page=3&categoryId=cat-unknown', [{ id: 'cat-tacos', name: 'Tacos' }], true],
    ['/fr/menu?view=bundles&categoryId=cat-tacos', [{ id: 'cat-tacos', name: 'Tacos' }], true],
  ])('normalizes unsupported route selection %s to All', (url, categories, categoriesComplete) => {
    setOrderTypeContext(null, false);
    window.history.replaceState({}, '', url);

    const { result, unmount } = renderHook(() =>
      usePublicMenu(false, menuSnapshot(categories, categoriesComplete), 'cat-tacos', true),
    );
    try {
      expect(result.current.selectedView).toBe('all');
    } finally {
      unmount();
      window.history.replaceState({}, '', '/');
    }
  });

  it('lets an explicit All URL override stale category props, preserving its page', () => {
    setOrderTypeContext(null, false);
    window.history.replaceState({}, '', '/fr/menu?page=2');
    const historyLength = window.history.length;

    const { result, unmount } = renderHook(() => usePublicMenu(false, undefined, 'cat-tacos', true));
    try {
      expect(result.current.selectedView).toBe('all');
      expect(new URLSearchParams(window.location.search).toString()).toBe('page=2');
      expect(window.history.length).toBe(historyLength);
    } finally {
      unmount();
      window.history.replaceState({}, '', '/');
    }
  });

  it('leaves legacy separate-menu selection driven by server props', () => {
    setOrderTypeContext(null, false);
    window.history.replaceState({}, '', '/fr/menu?categoryId=cat-tacos');

    const { result, unmount } = renderHook(() => usePublicMenu(false, undefined, 'cat-main', false));
    try {
      expect(result.current.selectedView).toBe('cat-main');
    } finally {
      unmount();
      window.history.replaceState({}, '', '/');
    }
  });

  it('still returns categories and the All selection for category-offers tabs', () => {
    mockCategories = [{ id: 'cat-tacos', name: 'Tacos' }];
    setOrderTypeContext(null, false);

    const { result } = renderHook(() => usePublicMenu(false));

    expect(result.current.categories).toEqual(mockCategories);
    expect(result.current.selectedView).toBe('all');
    expect(mockGetProducts).not.toHaveBeenCalled();
    expect(mockGetBundles).not.toHaveBeenCalled();
  });
});

describe('usePublicMenu — the guest channel reaches the products fetch', () => {
  it('forwards the chosen channel', async () => {
    setOrderTypeContext(OrderType.Takeaway, true);

    renderHook(() => usePublicMenu());

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(channelOfCall()).toBe(OrderType.Takeaway);
  });

  it('forwards null when the guest has chosen nothing — the dominant browse state', async () => {
    setOrderTypeContext(null, true);

    renderHook(() => usePublicMenu());

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(channelOfCall()).toBeNull();
  });

  it('refetches with the new channel when the guest switches', async () => {
    setOrderTypeContext(null, true);
    const { rerender } = renderHook(() => usePublicMenu());
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(1));

    setOrderTypeContext(OrderType.DineIn, true);
    await act(async () => rerender());

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(2));
    expect(channelOfCall(1)).toBe(OrderType.DineIn);
  });
});

describe('usePublicMenu — hydration gate', () => {
  it('fetches nothing until the persisted choice is read back', async () => {
    setOrderTypeContext(null, false);

    renderHook(() => usePublicMenu());

    // Not merely "not yet" — the effect ran and deliberately skipped.
    await act(async () => {});
    expect(mockGetProducts).not.toHaveBeenCalled();
  });

  it('fires ONCE, with the restored channel, rather than twice around the guess', async () => {
    setOrderTypeContext(null, false);
    const { rerender } = renderHook(() => usePublicMenu());
    await act(async () => {});

    // Hydration completes and reveals a stored Delivery.
    setOrderTypeContext(OrderType.Delivery, true);
    await act(async () => rerender());

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(1));
    expect(channelOfCall()).toBe(OrderType.Delivery);
  });
});

/** The channel `getPublicMenuBundles` was called with — its 3rd positional argument. */
function bundleChannelOfCall(index = 0): OrderType | null | undefined {
  return mockGetBundles.mock.calls[index]?.[2];
}

describe('usePublicMenu — bundles follow the channel too (§9.2)', () => {
  // This suite used to assert the OPPOSITE, because `GetMenuBundlesQuery` took no channel: bundles
  // rendered as fully orderable however the guest was ordering. §9.2 wired the query, so the same
  // rule as products applies — a switch has to re-resolve the list, and the cost the old test named
  // (bouncing the guest back to page 1) is now the correct price for not showing stale verdicts.
  //
  // Since the bundles are grouped into the category tabs, the list also loads on EVERY view — the
  // mount fetch below happens on the All view, before any tab is chosen.
  it('loads the bundle list on mount, without the guest visiting the bundles tab', async () => {
    setOrderTypeContext(OrderType.Takeaway, true);

    renderHook(() => usePublicMenu());

    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(1));
    expect(bundleChannelOfCall(0)).toBe(OrderType.Takeaway);
  });

  it('forwards the chosen channel on the tab-entry refresh too', async () => {
    setOrderTypeContext(OrderType.Takeaway, true);
    const { result } = renderHook(() => usePublicMenu());

    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(1));
    await act(async () => result.current.setSelectedView(MENU_BUNDLES_KEY));

    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(2));
    expect(bundleChannelOfCall(1)).toBe(OrderType.Takeaway);
  });

  it('refetches with the new channel when the guest switches — exactly once', async () => {
    setOrderTypeContext(null, true);
    const { rerender } = renderHook(() => usePublicMenu());
    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(1));

    setOrderTypeContext(OrderType.Takeaway, true);
    await act(async () => rerender());

    // The tab-entry refresh reads the channel REF, so a switch while the tab is open fires the
    // channel effect alone — a second fetch here would be a duplicate request with the same answer.
    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(mockGetBundles).toHaveBeenCalledTimes(2);
    expect(bundleChannelOfCall(1)).toBe(OrderType.Takeaway);
  });

  it('waits for hydration, like products — a guess costs an undimmed→dimmed flash', async () => {
    setOrderTypeContext(null, false);
    renderHook(() => usePublicMenu());

    await act(async () => {});
    expect(mockGetBundles).not.toHaveBeenCalled();
  });
});
