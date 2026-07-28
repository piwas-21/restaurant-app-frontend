import { renderHook, act, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { usePublicMenu, MENU_BUNDLES_KEY } from './usePublicMenu';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';

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
jest.mock('./publicMenu/usePublicMenuCategories', () => ({
  usePublicMenuCategories: () => [],
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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
  mockGetBundles.mockResolvedValue({ success: true, data: { items: [], totalPages: 1, totalCount: 0 } });
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
  it('forwards the chosen channel', async () => {
    setOrderTypeContext(OrderType.Takeaway, true);
    const { result } = renderHook(() => usePublicMenu());

    await act(async () => result.current.setSelectedView(MENU_BUNDLES_KEY));

    await waitFor(() => expect(mockGetBundles).toHaveBeenCalled());
    expect(bundleChannelOfCall()).toBe(OrderType.Takeaway);
  });

  it('refetches with the new channel when the guest switches', async () => {
    setOrderTypeContext(null, true);
    const { result, rerender } = renderHook(() => usePublicMenu());

    await act(async () => result.current.setSelectedView(MENU_BUNDLES_KEY));
    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(1));

    setOrderTypeContext(OrderType.Takeaway, true);
    await act(async () => rerender());

    await waitFor(() => expect(mockGetBundles).toHaveBeenCalledTimes(2));
    expect(bundleChannelOfCall(1)).toBe(OrderType.Takeaway);
  });

  it('waits for hydration, like products — a guess costs an undimmed→dimmed flash', async () => {
    setOrderTypeContext(null, false);
    const { result } = renderHook(() => usePublicMenu());

    await act(async () => result.current.setSelectedView(MENU_BUNDLES_KEY));

    expect(mockGetBundles).not.toHaveBeenCalled();
  });
});
