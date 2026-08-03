import { renderHook } from '@testing-library/react';
import { useCartItemMutations } from './useCartItemMutations';
import { basketService } from '@/services/basketService';
import { ApiError } from '@/utils/apiClient';
import { initialState } from '@/components/cart/cartReducer';
import type { CartAction } from '@/components/cart/cartTypes';

jest.mock('@/services/basketService', () => ({
  basketService: {
    addItemToBasket: jest.fn(),
    updateBasketItem: jest.fn(),
    removeItemFromBasket: jest.fn(),
  },
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn(), isLoggedInForAnalytics: jest.fn(() => false) }));

const UNEXPECTED = 'An unexpected error occurred.';
const BASKET_GONE = 'Your shopping cart is empty or expired';

const mocked = basketService as jest.Mocked<typeof basketService>;

/**
 * Issue #415. `PUT|DELETE /api/Basket/items/{id}` answers a missing ITEM and a missing BASKET with
 * the same 404, and the hook must do opposite things with them. The old substring test for
 * `'not found'` matched both, so a basket-level failure took the silent-resync branch — and because
 * `GetBasketQuery` answers a missing basket with an empty basket and a SUCCESS, one tap on "−"
 * replaced the guest's whole cart with "Your cart is empty" and reported nothing.
 *
 * These tests drive the hook directly with a mocked `dispatch`, so what they assert is the ACTIONS
 * the hook emits. Whether a dispatched error then survives to the screen is `cartReducer`'s job
 * (its ROLLBACK arm carries `error` forward while SYNC_BASKET nulls it) and is covered there.
 */
describe('useCartItemMutations — the two basket 404s', () => {
  const syncBasket = jest.fn<Promise<void>, []>();
  const dispatch = jest.fn<void, [CartAction]>();
  const ensureSession = jest.fn();

  const setup = () =>
    renderHook(() => useCartItemMutations(initialState, dispatch, ensureSession, syncBasket, UNEXPECTED, BASKET_GONE))
      .result.current;

  const errorActions = () =>
    dispatch.mock.calls.map(([a]) => a).filter((a) => a.type === 'SET_ERROR' || a.type === 'ROLLBACK');

  const notFound = (message: string, errorCode?: string) => new ApiError(404, message, [message], errorCode);

  beforeEach(() => {
    jest.clearAllMocks();
    syncBasket.mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe.each([
    ['removeItem', () => mocked.removeItemFromBasket, (m: ReturnType<typeof setup>) => m.removeItem('item-1')],
    ['updateItem', () => mocked.updateBasketItem, (m: ReturnType<typeof setup>) => m.updateItem('item-1', 2)],
  ])('%s', (_name, service, invoke) => {
    it('resyncs silently when the ITEM is already gone', async () => {
      service().mockRejectedValue(notFound('Basket item not found', 'BasketItemNotFound'));

      // Must not reject: this exit deliberately returns rather than rethrowing.
      await expect(invoke(setup())).resolves.toBeUndefined();

      expect(syncBasket).toHaveBeenCalledTimes(1);
      expect(errorActions()).toHaveLength(0);
    });

    it('reports — and does NOT resync — when the whole BASKET is gone (#415)', async () => {
      service().mockRejectedValue(notFound('Basket not found', 'BasketNotFound'));

      await expect(invoke(setup())).rejects.toThrow();

      // The regression this file exists for. A resync here is what silently emptied the cart.
      expect(syncBasket).not.toHaveBeenCalled();
      expect(errorActions()).toEqual([
        // Localized, NOT the server's "Basket not found" — that describes a row, not the guest.
        { type: 'SET_ERROR', payload: { error: BASKET_GONE } },
        { type: 'ROLLBACK', payload: { previousState: initialState } },
      ]);
    });

    it('reports an UNCODED 404 rather than resyncing', async () => {
      // A backend that predates the codes. Reporting is the fail-safe half.
      service().mockRejectedValue(notFound('Basket not found'));

      await expect(invoke(setup())).rejects.toThrow();

      expect(syncBasket).not.toHaveBeenCalled();
      // No code, so the server's own sentence is shown, as for any other failure.
      expect(errorActions()[0]).toEqual({ type: 'SET_ERROR', payload: { error: 'Basket not found' } });
    });

    it('falls back to the translated sentence when the server authored nothing', async () => {
      // What `basketService` throws on a 200 + success:false — a plain Error, so `getErrorMessage`
      // returns null and the client-side fallback has to fire.
      service().mockRejectedValue(new Error('Failed to update basket item'));

      await expect(invoke(setup())).rejects.toThrow();

      expect(syncBasket).not.toHaveBeenCalled();
      expect(errorActions()[0]).toEqual({ type: 'SET_ERROR', payload: { error: UNEXPECTED } });
    });
  });

  it('addItem never resyncs, even on the item-gone code', async () => {
    // `addItem` deliberately has no already-gone branch: a not-found is an ordinary answer to an
    // ADD ("Product not found"), and resyncing there would swallow the message.
    mocked.addItemToBasket.mockRejectedValue(notFound('Basket item not found', 'BasketItemNotFound'));

    await expect(setup().addItem({ productId: 'p1', quantity: 1 })).rejects.toThrow();

    expect(syncBasket).not.toHaveBeenCalled();
    expect(errorActions()[0]).toEqual({
      type: 'SET_ERROR',
      payload: { error: 'Basket item not found' },
    });
  });

  it('addItem shows the localized sentence when the basket is gone', async () => {
    mocked.addItemToBasket.mockRejectedValue(notFound('Basket not found', 'BasketNotFound'));

    await expect(setup().addItem({ productId: 'p1', quantity: 1 })).rejects.toThrow();

    expect(errorActions()[0]).toEqual({ type: 'SET_ERROR', payload: { error: BASKET_GONE } });
  });
});
