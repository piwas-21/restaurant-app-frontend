import { act, renderHook, waitFor } from '@testing-library/react';
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

  // This used to `mockRejectedValue(new Error('boom'))`, which pinned a shape the producer cannot
  // produce: `getFeaturedSpecial` catches its own failure and resolves `{success:true, data:null}`
  // (`menuService.test.ts` — "still absorbs its failure on purpose"). So the rejection was the only
  // thing making the hook's catch look covered, and the catch is now gone. Mock what the real
  // producer returns instead.
  it('renders no banner when the fetch fails — the swallowed failure arrives as data:null', async () => {
    mockFetch.mockResolvedValue({ success: true, data: null, message: 'No featured special available' });
    const { result } = renderHook(() => useFeaturedSpecial());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    // `null` is also the INITIAL state, so this alone would pass with the clear removed; the
    // sibling below seeds a special first, which is what actually pins the clear-on-miss.
    expect(result.current.featuredSpecial).toBeNull();
  });

  it('a slow answer for the PREVIOUS channel cannot overwrite the current one', async () => {
    // What the `active` flag is for. Two switches in flight and the first resolving last is the
    // "two resolutions, two moments, one of them stale" state §9.10 exists to prevent — and it is
    // the permissive verdict that usually arrives late, so losing this race offers the guest an
    // item the catalog below refuses.
    const DINE_IN_ONLY = { id: 'p2', name: 'Table d’hôte', basePrice: 30 };
    let resolveTakeaway: (value: unknown) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTakeaway = resolve;
        }),
    );

    setup({ orderType: OrderType.Takeaway });
    const { result, rerender } = renderHook(() => useFeaturedSpecial());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockFetch.mockResolvedValue({ success: true, data: DINE_IN_ONLY });
    setup({ orderType: OrderType.DineIn });
    rerender();
    await waitFor(() => expect(result.current.featuredSpecial).toEqual(DINE_IN_ONLY));

    // The Takeaway request now lands, last. It must be discarded.
    await act(async () => {
      resolveTakeaway({ success: true, data: SPECIAL });
    });

    expect(result.current.featuredSpecial).toEqual(DINE_IN_ONLY);
  });

  it('clears a special already on screen when a channel switch comes back empty', async () => {
    // The stale-verdict case §9.10 exists to prevent: without the clear, the PREVIOUS channel's
    // usually-permissive answer keeps driving the banner after the switch.
    setup({ orderType: OrderType.Takeaway });
    const { result, rerender } = renderHook(() => useFeaturedSpecial());
    await waitFor(() => expect(result.current.featuredSpecial).toEqual(SPECIAL));

    mockFetch.mockResolvedValue({ success: true, data: null });
    setup({ orderType: OrderType.DineIn });
    rerender();

    await waitFor(() => expect(result.current.featuredSpecial).toBeNull());
  });
});
