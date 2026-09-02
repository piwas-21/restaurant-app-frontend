import { act, renderHook, waitFor } from '@testing-library/react';
import { drinkListCache, useDrinkUpsell } from './useDrinkUpsell';
import { getProducts } from '@/services/menuService';
import { OrderType } from '@/types/order';

const mockAddItem = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
// `mock`-prefixed so babel-plugin-jest-hoist lets the factories below reference them: the mock
// factory is hoisted above these declarations and may only close over names matching /^mock/.
let mockOrderTypeState: { orderType: OrderType | null } = { orderType: null };
let mockHydrated = true;

const mockNotifyAddFailed = jest.fn();

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
jest.mock('@/hooks/cart/useCartFeedback', () => ({
  useCartFeedback: () => ({ notifyItemAdded: jest.fn(), notifyAddFailed: mockNotifyAddFailed }),
}));
jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: mockOrderTypeState, hydrated: mockHydrated }),
}));
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));

const mockGetProducts = getProducts as jest.Mock;

const row = (id: string, name: string, basePrice: number, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  basePrice,
  isActive: true,
  isAvailable: true,
  ...extra,
});

const respond = (items: unknown[]) => mockGetProducts.mockResolvedValue({ data: { items } });

beforeEach(() => {
  jest.clearAllMocks();
  // The hook memoises the drinks list per channel for the whole session — the behaviour we want in
  // the browser and a cross-test leak here.
  drinkListCache.clear();
  mockOrderTypeState = { orderType: null };
  mockHydrated = true;
});

async function freshHook() {
  const rendered = renderHook(() => useDrinkUpsell());
  await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
  return rendered;
}

describe('useDrinkUpsell — what it asks the server for', () => {
  it('asks for BEVERAGES by enum name, carrying the channel so a blocked drink is never offered', async () => {
    respond([row('cola', 'Cola', 3.5)]);
    mockOrderTypeState = { orderType: OrderType.Delivery };

    await freshHook();

    // `Beverage`, not `beverage`: query-string enum binding is by NAME, while responses carry the
    // camelCase `[EnumMember]` value. Sending the wire value silently returns the whole catalogue.
    expect(mockGetProducts).toHaveBeenCalledWith(1, expect.any(Number), null, { type: 'Beverage' }, OrderType.Delivery);
  });

  it('drops a drink the server says cannot be ordered on this channel', async () => {
    respond([
      row('cola', 'Cola', 3.5),
      row('beer', 'Beer', 6, { availability: { canOrder: false } }),
      row('gone', 'Sold out', 4, { isAvailable: false }),
    ]);

    const { result } = await freshHook();
    await waitFor(() => expect(result.current.drinks).toHaveLength(1));
    expect(result.current.drinks[0].id).toBe('cola');
  });

  /**
   * A failed upsell is not a failed order. `useSheetFlow` derives the step from a NON-EMPTY list, so
   * an empty answer here means the step simply never appears.
   */
  it('degrades to no drinks when the fetch fails', async () => {
    mockGetProducts.mockRejectedValue(new Error('offline'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = await freshHook();
    await waitFor(() => expect(result.current.drinks).toEqual([]));

    consoleError.mockRestore();
  });
});

describe('useDrinkUpsell — selection and commit', () => {
  it('counts up, counts down, and drops the row at zero', async () => {
    respond([row('cola', 'Cola', 3.5)]);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.drinks).toHaveLength(1));

    act(() => result.current.add('cola'));
    act(() => result.current.add('cola'));
    expect(result.current.selected).toEqual({ cola: 2 });
    expect(result.current.subtotal).toBe(7);

    act(() => result.current.remove('cola'));
    act(() => result.current.remove('cola'));
    expect(result.current.selected).toEqual({});
    expect(result.current.subtotal).toBe(0);
  });

  /**
   * The load-bearing claim of §3.4: a chosen drink becomes its OWN basket line. Attaching it as a
   * suggested side would make it a child of the dish on the kitchen ticket and would drag it into
   * `useLinePrice`, which the guest/waiter parity suites pin as the line's only price authority.
   */
  it('adds each drink as its own basket line, not as a side on the dish', async () => {
    respond([row('cola', 'Cola', 3.5), row('ayran', 'Ayran', 3)]);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.drinks).toHaveLength(2));

    act(() => result.current.add('cola'));
    act(() => result.current.add('cola'));
    act(() => result.current.add('ayran'));
    await act(async () => {
      await result.current.addSelected();
    });

    expect(mockAddItem).toHaveBeenCalledTimes(2);
    expect(mockAddItem).toHaveBeenCalledWith({ productId: 'cola', quantity: 2 });
    expect(mockAddItem).toHaveBeenCalledWith({ productId: 'ayran', quantity: 1 });
    // Cleared, so the next sheet does not re-add what this one already committed.
    expect(result.current.selected).toEqual({});
  });

  it('reports the selection for the review, with quantities and localized names', async () => {
    respond([row('cola', 'Cola', 3.5, { content: { tr: { name: 'Kola' } } })]);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.drinks).toHaveLength(1));

    expect(result.current.summary('en')).toEqual([]);

    act(() => result.current.add('cola'));
    expect(result.current.summary('en')).toEqual(['Cola']);
    act(() => result.current.add('cola'));
    expect(result.current.summary('tr')).toEqual(['2 × Kola']);
  });

  it('waits for the channel to hydrate before asking, so it cannot ask on a guess', async () => {
    respond([row('cola', 'Cola', 3.5)]);
    mockHydrated = false;

    renderHook(() => useDrinkUpsell());

    expect(mockGetProducts).not.toHaveBeenCalled();
  });
});

describe('useDrinkUpsell — a refused drink must not take the DISH down with it', () => {
  /**
   * The dish is already in the basket by the time `addSelected` runs. Letting a refused drink throw
   * reported the whole add as failed and left the sheet open — so the guest pressed Add again and
   * bought the dish twice.
   */
  it('never throws at the caller, whatever the server says about a drink', async () => {
    respond([row('cola', 'Cola', 3.5), row('ayran', 'Ayran', 3)]);
    const { result } = await freshHook();
    await waitFor(() => expect(result.current.drinks).toHaveLength(2));

    mockAddItem.mockRejectedValueOnce(new Error('sold out')).mockResolvedValueOnce(undefined);
    act(() => result.current.add('cola'));
    act(() => result.current.add('ayran'));

    await act(async () => {
      await expect(result.current.addSelected()).resolves.toBeUndefined();
    });

    // It kept going: the second drink still went in.
    expect(mockAddItem).toHaveBeenCalledTimes(2);
    // It said so, once, on its own channel.
    expect(mockNotifyAddFailed).toHaveBeenCalledTimes(1);
    // And it cleared the selection, so a retry cannot re-add what already landed.
    expect(result.current.selected).toEqual({});
  });
});

describe('useDrinkUpsell — the cached list goes stale', () => {
  /**
   * The rows carry a §9.10 availability verdict resolved at fetch time, and a table-service session
   * can sit open for hours. Without a TTL a beverage the kitchen marked unavailable keeps being
   * offered here long after the browse grid stopped offering it.
   */
  it('refetches once the cached list is older than its TTL', async () => {
    respond([row('cola', 'Cola', 3.5)]);
    const { unmount } = await freshHook();
    expect(mockGetProducts).toHaveBeenCalledTimes(1);
    unmount();

    // Still fresh: served from the cache.
    renderHook(() => useDrinkUpsell()).unmount();
    expect(mockGetProducts).toHaveBeenCalledTimes(1);

    // Six minutes later it is not.
    const cached = drinkListCache.get('none');
    drinkListCache.set('none', { ...cached!, at: cached!.at - 6 * 60 * 1000 });
    renderHook(() => useDrinkUpsell());
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(2));
  });
});
