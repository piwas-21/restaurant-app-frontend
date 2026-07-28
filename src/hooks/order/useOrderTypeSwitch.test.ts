import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrderTypeSwitch } from './useOrderTypeSwitch';
import { setBasketOrderType } from '@/services/basketChannelService';
import { OrderType } from '@/types/order';
import { trackEvent } from '@/lib/analytics';
import type { BasketChannelSwitch } from '@/types/basketChannel';

jest.mock('@/services/basketChannelService', () => ({
  setBasketOrderType: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const mockSyncBasket = jest.fn();
const mockEnsureSession = jest.fn().mockReturnValue('session-1');
let mockItemCount = 1;
let mockCurrentOrderType: string | null = null;
// What the SERVER says the basket is on — `BasketDto.orderType`, added in §9.13. Null is "not set",
// which is what every pre-§9.13 caller effectively had.
let mockServerOrderType: string | null = null;
// The SYNCED line count, which the reconcile reads — deliberately separate from the optimistic
// `mockItemCount` so a test can hold them apart, which is the whole reason the hook takes this one.
let mockBasketItemCount = 1;
// `state.basket` is null outright after a failed mount sync — a state both the count and the channel
// have to survive.
let mockBasketIsNull = false;

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({
    // `items` is the OPTIMISTIC list the hook reads; `basket` deliberately lags it, mirroring the
    // real reducer, so a test that passes here would fail against the `basket.items` version.
    state: {
      items: Array.from({ length: mockItemCount }, (_, i) => ({ id: `i${i}` })),
      basket: mockBasketIsNull
        ? null
        : {
            items: Array.from({ length: mockBasketItemCount }, (_, i) => ({ id: `b${i}` })),
            orderType: mockServerOrderType,
          },
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
  mockBasketItemCount = 1;
  mockBasketIsNull = false;
  mockCurrentOrderType = null;
  mockServerOrderType = null;
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

  // Was "the 404 an empty cart produces": §9.13's upsert means an empty cart now SUCCEEDS, so this
  // covers a genuine failure (network, session) rather than the expected shape it used to describe.
  // The guest's tap must still register either way — the pre-set is a nicety, not a precondition.
  it("swallows a failed pre-set rather than dropping the guest's tap", async () => {
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
    // The backstop for the "pick a channel, then browse" journey. §9.13 made the empty-cart pre-set
    // stick (the endpoint upserts rather than 404s), so this now covers the case where that call
    // failed or was refused rather than the case where it could never work.
    mockItemCount = 0;
    mockBasketItemCount = 0;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({}));
    const { rerender } = renderHook(() => useOrderTypeSwitch());
    expect(mockedSet).not.toHaveBeenCalled();

    // The SYNCED count is what moves the reconcile: the line has reached the server, so an assert
    // now has something to succeed against.
    mockItemCount = 1;
    mockBasketItemCount = 1;
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
    mockBasketItemCount = 2;
    await act(async () => {
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledTimes(2);
  });

  // §9.13's frontend half. Before it the client had only a local ref: it could not tell "the server
  // took it" from "the server refused it", and a refusal was remembered as success — leaving the add
  // guard disarmed for the rest of the session with nothing able to notice.
  it('sends NOTHING when the server already agrees — the reconcile, not an assert', async () => {
    mockItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockServerOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({}));

    renderHook(() => useOrderTypeSwitch());
    await act(async () => {});

    expect(mockedSet).not.toHaveBeenCalled();
  });

  // NOTE: this one also passes against the pre-§9.13 code, which asserted here too. It earns its
  // place as the negative half of the pair above — an inverted reconcile condition would send
  // nothing here — not as a regression guard.
  it('asserts when the server is on a DIFFERENT channel', async () => {
    mockItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockServerOrderType = OrderType.DineIn;
    mockedSet.mockResolvedValue(reply({}));

    renderHook(() => useOrderTypeSwitch());
    await act(async () => {});

    expect(mockedSet).toHaveBeenCalledWith(OrderType.Takeaway);
  });

  it('retries after a REFUSED assert once the cart changes — the case the old local ref could not see', async () => {
    // The server answers 200 with `applied: false` when a line forbids the channel. That is not an
    // error, so the old code recorded it as done; the basket stayed on its old channel forever.
    // Removing the offending line is itself a cart change, which is what makes the retry land.
    mockItemCount = 2;
    mockBasketItemCount = 2;
    mockCurrentOrderType = OrderType.Takeaway;
    mockServerOrderType = null;
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));

    const { rerender } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {});
    expect(mockedSet).toHaveBeenCalledTimes(1);

    // The guest deletes the line the channel forbids. The OPTIMISTIC count drops first, while the
    // DELETE is still in flight — and that must NOT trigger the retry, because the server would
    // still see the offending line. Only the synced count moving does.
    mockItemCount = 1;
    await act(async () => {
      rerender();
    });
    expect(mockedSet).toHaveBeenCalledTimes(1);

    mockedSet.mockResolvedValue(reply({}));
    mockBasketItemCount = 1;
    await act(async () => {
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledTimes(2);
  });

  // The genuinely new capability: a 200 carrying `applied: false` used to be indistinguishable from
  // success. Deleting the whole `.then` branch left every other test green.
  it('reports a REFUSED assert instead of recording it as done', async () => {
    mockItemCount = 1;
    mockBasketItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));

    renderHook(() => useOrderTypeSwitch());
    await act(async () => {});

    expect(trackEvent).toHaveBeenCalledWith('basket_channel_assert_refused', {
      orderType: OrderType.Takeaway,
      itemCount: 1,
    });
    // And it must NOT escalate: no dialog for a switch the guest never asked for, and no silent
    // deletion of their lines.
    expect(mockSyncBasket).not.toHaveBeenCalled();
  });

  // Line 87's `?? 0` / `?? null`: `state.basket` is null outright after a failed mount sync, and the
  // reconcile must treat that as "nothing synced yet" rather than throwing on the way to arming a
  // security guard.
  it('treats a null basket as nothing to reconcile', async () => {
    mockBasketIsNull = true;
    mockItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({}));

    renderHook(() => useOrderTypeSwitch());
    await act(async () => {});

    expect(mockedSet).not.toHaveBeenCalled();
  });

  // The empty-cart pre-set's own refusal branch. Reachable exactly when the client BELIEVES the cart
  // is empty and the server disagrees — the failed-mount-sync state above — so the recorded attempt
  // has to be rolled back or the effect will never try again.
  it('does not record a refused empty-cart pre-set as done', async () => {
    mockItemCount = 0;
    mockBasketItemCount = 0;
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { result, rerender } = renderHook(() => useOrderTypeSwitch());

    await act(async () => {
      await result.current.request(OrderType.Takeaway, 'sidebar', false);
    });
    expect(mockedSet).toHaveBeenCalledTimes(1);

    // The guest's first add lands; the effect must re-assert rather than trust the refused pre-set.
    mockCurrentOrderType = OrderType.Takeaway;
    mockItemCount = 1;
    mockBasketItemCount = 1;
    await act(async () => {
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledTimes(2);
  });

  // Covers the one-attempt-per-cart-state rule at its least obvious moment: another tab moves the
  // basket to a THIRD channel, so `serverOrderType` changes and the effect re-runs — but this tab's
  // cart has not moved, so there is nothing new to try and it stays quiet. Last-active-tab-wins is
  // the accepted model here; the alternative is two tabs asserting at each other.
  it('does not re-assert when only the server channel drifts under it', async () => {
    mockItemCount = 1;
    mockBasketItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockServerOrderType = null;
    mockedSet.mockResolvedValue(reply({ applied: false, conflicts: [CONFLICT] }));
    const { rerender } = renderHook(() => useOrderTypeSwitch());
    await act(async () => {});
    expect(mockedSet).toHaveBeenCalledTimes(1);

    mockServerOrderType = OrderType.DineIn;
    await act(async () => {
      rerender();
    });

    expect(mockedSet).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when the assert lands', async () => {
    mockItemCount = 1;
    mockBasketItemCount = 1;
    mockCurrentOrderType = OrderType.Takeaway;
    mockedSet.mockResolvedValue(reply({}));

    renderHook(() => useOrderTypeSwitch());
    await act(async () => {});

    expect(trackEvent).not.toHaveBeenCalled();
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
