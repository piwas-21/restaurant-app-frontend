import { renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useFeaturedSpecial } from './useFeaturedSpecial';
import { getFeaturedSpecial } from '@/services/menuService';
import { useOrderType } from '@/contexts/OrderTypeContext';

jest.mock('@/services/menuService', () => ({ getFeaturedSpecial: jest.fn() }));
jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));

const mockFetch = getFeaturedSpecial as jest.Mock;
const mockOrderType = useOrderType as jest.Mock;

const SPECIAL = { id: 'p1', name: 'Chef Special', basePrice: 20 };

function setup({ orderType = null, hydrated = true }: { orderType?: OrderType | null; hydrated?: boolean } = {}) {
  mockOrderType.mockReturnValue({ state: { orderType }, hydrated });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ success: true, data: SPECIAL });
  setup();
});

describe('useFeaturedSpecial', () => {
  it('asks the server about the guest’s chosen channel', async () => {
    setup({ orderType: OrderType.DineIn });
    renderHook(() => useFeaturedSpecial());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(OrderType.DineIn));
  });

  it('waits for hydration — "no channel chosen" and "not read back yet" are both null', async () => {
    // Fetching before hydration makes a returning guest load the banner twice and watch a blocked
    // special flip orderable → blocked, the trap S4 hit on the grid.
    setup({ orderType: null, hydrated: false });
    const { rerender } = renderHook(() => useFeaturedSpecial());

    expect(mockFetch).not.toHaveBeenCalled();

    setup({ orderType: OrderType.Takeaway, hydrated: true });
    rerender();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(OrderType.Takeaway));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-resolves when the guest switches channel — the item did not change, the verdict did', async () => {
    setup({ orderType: OrderType.Takeaway });
    const { rerender } = renderHook(() => useFeaturedSpecial());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    setup({ orderType: OrderType.DineIn });
    rerender();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch).toHaveBeenLastCalledWith(OrderType.DineIn);
  });

  it('exposes the special once loaded', async () => {
    const { result } = renderHook(() => useFeaturedSpecial());

    await waitFor(() => expect(result.current.featuredSpecial).toEqual(SPECIAL));
  });

  it('renders no banner when the fetch fails — a missing hero is not an error state', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useFeaturedSpecial());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current.featuredSpecial).toBeNull();
  });
});
