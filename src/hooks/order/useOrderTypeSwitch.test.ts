import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrderTypeSwitch } from './useOrderTypeSwitch';
import { setBasketOrderType } from '@/services/basketChannelService';
import { OrderType } from '@/types/order';
import type { BasketChannelSwitch } from '@/types/basketChannel';

jest.mock('@/services/basketChannelService', () => ({
  setBasketOrderType: jest.fn(),
}));

const mockSyncBasket = jest.fn();
const mockEnsureSession = jest.fn().mockReturnValue('session-1');
let mockItemCount = 1;
let mockCurrentOrderType: string | null = null;

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({
    // `items` is the OPTIMISTIC list the hook reads; `basket` deliberately lags it, mirroring the
    // real reducer, so a test that passes here would fail against the `basket.items` version.
    state: {
      items: Array.from({ length: mockItemCount }, (_, i) => ({ id: `i${i}` })),
      basket: { items: [] },
    },
    syncBasket: mockSyncBasket,
  }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: mockCurrentOrderType } }),
}));
jest.mock('@/contexts/SessionContext', () => ({
  useSessionContext: () => ({ ensureSession: mockEnsureSession }),
}));

const mockedSet = setBasketOrderType as jest.MockedFunction<typeof setBasketOrderType>;

const CONFLICT = {
  basketItemId: 'line-1',
  productName: 'Dürüm',
  quantity: 2,
  allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
};

function reply(over: Partial<BasketChannelSwitch>): BasketChannelSwitch {
  return { applied: true, conflicts: [], removed: [], basket: null, ...over };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockItemCount = 1;
  mockCurrentOrderType = null;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('useOrderTypeSwitch', () => {
  it('sends the channel to the server on every switch — this is what arms the add guard', async () => {
    mockedSet.mockResolvedValue(reply({}));
    const { result } = renderHook(() => useOrderTypeSwitch());

    await act(async () => {
      await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    // Dry run by default: a caller that forgets the flag must never trigger a deletion.
    expect(mockedSet).toHaveBeenCalledWith(OrderType.DineIn);
  });

  it('lets a clean switch through without opening anything', async () => {
    mockedSet.mockResolvedValue(reply({}));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    expect(proceed).toBe(true);
    expect(result.current.pending).toBeNull();
  });

  it('refuses the commit and opens the confirm when lines would be dropped', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    // The caller must NOT commit — a committed type with the items still in the cart is the
    // "silent drop" §4.4 forbids, just inverted.
    expect(proceed).toBe(false);
    expect(result.current.pending).toEqual({
      orderType: OrderType.DineIn,
      conflicts: [CONFLICT],
      source: 'sidebar',
      forceModal: false,
    });
    expect(mockSyncBasket).not.toHaveBeenCalled();
  });

  it('removes and re-reads the basket only once the guest confirms', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    mockedSet.mockResolvedValue(reply({ removed: [CONFLICT] }));
    let applied: Awaited<ReturnType<typeof result.current.confirm>> | undefined;
    await act(async () => {
      applied = await result.current.confirm();
    });

    expect(mockedSet).toHaveBeenLastCalledWith(OrderType.DineIn, true);
    expect(applied?.orderType).toBe(OrderType.DineIn);
    // Re-read rather than reconcile locally, so the badge, totals and tax move together.
    expect(mockSyncBasket).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.pending).toBeNull());
  });

  it('does not commit the type when the removal itself fails', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    mockedSet.mockRejectedValue(new Error('gone'));
    let applied: Awaited<ReturnType<typeof result.current.confirm>> | undefined;
    await act(async () => {
      applied = await result.current.confirm();
    });

    // Unlike the CHECK, this one fails closed: the guest agreed to remove lines and the removal did
    // not happen, so committing the type would arm the new channel over a cart that still holds
    // items it forbids. (The dialog staying open is asserted separately, below.)
    expect(applied).toBeNull();
    expect(mockSyncBasket).not.toHaveBeenCalled();
  });

  it('cancelling leaves both the basket and the order type alone', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    act(() => result.current.cancel());

    expect(result.current.pending).toBeNull();
    expect(mockedSet).toHaveBeenCalledTimes(1);
    expect(mockSyncBasket).not.toHaveBeenCalled();
  });

  it('does not make the guest wait on an empty cart, but still tells the server', async () => {
    mockItemCount = 0;
    mockedSet.mockResolvedValue(reply({}));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.Takeaway, 'sidebar', false);
    });

    expect(proceed).toBe(true);
    expect(result.current.pending).toBeNull();
    expect(mockedSet).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('swallows the 404 an empty cart produces when no basket row exists yet', async () => {
    mockItemCount = 0;
    mockedSet.mockRejectedValue(new Error('Basket not found'));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.Takeaway, 'sidebar', false);
    });

    expect(proceed).toBe(true);
  });

  it('FAILS OPEN when the conflict check itself errors', async () => {
    mockedSet.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    // Refusing here would strand the guest in a channel with no way out over a network blip, and
    // OrderChannelGuard still walks the whole basket at order creation.
    expect(proceed).toBe(true);
    expect(result.current.pending).toBeNull();
  });

  it('treats an applied:false with no conflicts as permission, not as a block', async () => {
    // Defensive: an older or partial server answer must not open an empty confirm dialog listing
    // nothing, which the guest could only cancel.
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [] }));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    expect(proceed).toBe(true);
    expect(result.current.pending).toBeNull();
  });
  it('reads the OPTIMISTIC cart, so a line added seconds ago still gets checked', async () => {
    // `state.basket` only catches up when the add round-trips. Reading it instead of `state.items`
    // calls a cart that just gained a line "empty", skips the check, and orphans that very line.
    mockItemCount = 1;
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    expect(proceed).toBe(false);
    expect(result.current.pending).not.toBeNull();
  });

  it('re-picking the type already in force is not a switch and checks nothing', async () => {
    // The cart and details surfaces call pickType with the CURRENT type purely to re-open the
    // contact modal. Offering to delete items there would be nonsense.
    mockCurrentOrderType = OrderType.DineIn;
    mockedSet.mockResolvedValue(reply({}));
    const { result } = renderHook(() => useOrderTypeSwitch());
    // Let the arm-the-guard effect settle first, so what follows measures `request` alone.
    await act(async () => {});
    mockedSet.mockClear();

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'cart', true);
    });

    expect(proceed).toBe(true);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it('refuses a second switch while one is still resolving', async () => {
    let release: ((v: BasketChannelSwitch) => void) | undefined;
    // The second reply is explicitly CLEAN. `jest.clearAllMocks()` does not reset implementations,
    // so without this the previous test's conflict reply leaks in and the assertion below passes
    // even with the in-flight guard deleted.
    mockedSet.mockReset();
    mockedSet.mockReturnValueOnce(new Promise((res) => (release = res)));
    mockedSet.mockResolvedValue(reply({}));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let first: Promise<boolean> | undefined;
    act(() => {
      first = result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    // Interleaved resolutions otherwise leave the modal naming one channel while the toggle shows
    // another, and the confirm deletes lines for the channel the guest already left.
    let second: boolean | undefined;
    await act(async () => {
      second = await result.current.request(OrderType.Delivery, 'sidebar', false);
    });
    expect(second).toBe(false);
    // The second switch never reached the server at all — the guard, not a coincidental reply.
    expect(mockedSet).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.(reply({}));
      await first;
    });
  });

  it('refuses a new switch while a confirm is still on screen', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.Delivery, 'sidebar', false);
    });

    expect(proceed).toBe(false);
    // Still the ORIGINAL pending switch — the dialog must not silently re-target.
    expect(result.current.pending?.orderType).toBe(OrderType.DineIn);
  });

  it('does not make the guest wait on the empty-cart call, and mints a session first', async () => {
    mockItemCount = 0;
    let release: ((v: BasketChannelSwitch) => void) | undefined;
    mockedSet.mockReturnValueOnce(new Promise((res) => (release = res)));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.Takeaway, 'sidebar', false);
    });

    // Resolved while the server call is STILL in flight — that is the property. An `await` here
    // would put a round-trip between the guest's tap and their own toggle lighting up.
    expect(proceed).toBe(true);
    // Without a session header the request is refused before a basket could exist, and the FIRST
    // pick a guest makes is usually on an empty cart.
    expect(mockEnsureSession).toHaveBeenCalled();
    expect(mockedSet).toHaveBeenCalledWith(OrderType.Takeaway);

    await act(async () => {
      release?.(reply({}));
    });
  });

  it('treats applied:true WITH conflicts as applied — the server is the authority', async () => {
    mockedSet.mockResolvedValue(reply({ applied: true, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    expect(proceed).toBe(true);
    expect(result.current.pending).toBeNull();
  });

  it('keeps the dialog open with a reason when the removal fails', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      await result.current.request(OrderType.DineIn, 'sidebar', false);
    });

    mockedSet.mockRejectedValue(new Error('gone'));
    await act(async () => {
      await result.current.confirm();
    });

    // Vanishing silently leaves the guest believing they removed items they still have.
    expect(result.current.pending).not.toBeNull();
    expect(result.current.error).toBe('order_type_conflict_error');
  });

  it('a refused second pick cannot retarget the intent of the switch awaiting confirmation', async () => {
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      await result.current.request(OrderType.DineIn, 'checkout_review', true);
    });

    await act(async () => {
      await result.current.request(OrderType.Delivery, 'sidebar', false);
    });

    // The intent rides INSIDE `pending`, so confirming replays the pick that raised the dialog —
    // a shared ref here silently swapped the analytics surface and dropped the forced modal.
    expect(result.current.pending).toMatchObject({
      orderType: OrderType.DineIn,
      source: 'checkout_review',
      forceModal: true,
    });
  });

  it('re-asserts the channel once the basket actually exists', async () => {
    // The empty-cart pre-set 404s BY CONSTRUCTION — only an add creates the basket row — so without
    // this the guard is never armed on the "pick a channel, then browse" journey.
    mockItemCount = 0;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({}));
    const { rerender } = renderHook(() => useOrderTypeSwitch());
    expect(mockedSet).not.toHaveBeenCalled();

    mockItemCount = 1;
    await act(async () => {
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('does not re-assert the same channel on every cart change', async () => {
    mockItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({}));
    const { rerender } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {
      rerender();
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledTimes(1);
  });

  it('retries the re-assert on the next cart change when it failed', async () => {
    mockItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockRejectedValueOnce(new Error('boom'));
    const { rerender } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {});
    expect(mockedSet).toHaveBeenCalledTimes(1);

    // A failed assert must not be remembered as done, or the guard stays disarmed for the session.
    mockedSet.mockResolvedValue(reply({}));
    mockItemCount = 2;
    await act(async () => {
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledTimes(2);
  });

  it("a session failure does not swallow the guest's tap", async () => {
    mockItemCount = 0;
    mockEnsureSession.mockImplementationOnce(() => {
      throw new Error('storage disabled');
    });
    const { result } = renderHook(() => useOrderTypeSwitch());

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.request(OrderType.Takeaway, 'sidebar', false);
    });

    // Escaping here would reject pickType from inside an onClick and the tap would do nothing at
    // all — over a pre-flight nicety.
    expect(proceed).toBe(true);
  });
});
