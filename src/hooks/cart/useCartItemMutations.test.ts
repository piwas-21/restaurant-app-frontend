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
 * `'not found'` matched both, so a basket-level failure would have taken the silent-resync branch —
 * and because `GetBasketQuery` answers a missing basket with an empty basket and a SUCCESS, one tap
 * on "−" would have replaced the guest's whole cart with "Your cart is empty", saying nothing.
 *
 * Conditional on purpose: it never fired in production, because the deployed backend wrapped both
 * 404s in an HTTP 200 + `success:false`, which made `getErrorMessage` return null and the branch
 * unreachable. Removing that wrapper is what arms the substring match — so these tests guard an
 * ordering hazard, not a live symptom, and they must land before that backend change ships.
 *
 * They drive the hook directly with a mocked `dispatch`, so what they assert is the ACTIONS emitted
 * and their ORDER. Whether an error then survives to the screen is `cartReducer`'s job — its
 * ROLLBACK arm carries `error` forward while SYNC_BASKET nulls it, which is why the basket-gone
 * path dispatches its message after the resync rather than before.
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

    it('never resyncs SILENTLY when the whole BASKET is gone (#415)', async () => {
      service().mockRejectedValue(notFound('Basket not found', 'BasketNotFound'));

      await expect(invoke(setup())).rejects.toThrow();

      // The regression this file exists for. The old substring match took the benign exit, which
      // resyncs and returns with NO error action at all — the cart emptied and said nothing.
      // Resyncing is fine; resyncing without a word is the bug. Order matters: SYNC_BASKET nulls
      // `error`, so a SET_ERROR dispatched before the resync would be wiped by it.
      expect(syncBasket).toHaveBeenCalledTimes(1);
      expect(errorActions()).toEqual([
        // Localized, NOT the server's "Basket not found" — that describes a row, not the guest.
        { type: 'SET_ERROR', payload: { error: BASKET_GONE } },
      ]);
      const syncCall = dispatch.mock.calls.findIndex(([a]) => a.type === 'SET_ERROR');
      expect(syncCall).toBeGreaterThan(-1);
      expect(syncBasket.mock.invocationCallOrder[0]).toBeLessThan(dispatch.mock.invocationCallOrder[syncCall]);
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

    it('shows the translated fallback for a 5xx, not the server’s internal prose', async () => {
      // Newly reachable: these endpoints used to wrap every failure in an HTTP 200, so a fault
      // arrived as a plain Error. Now it is a real 500, and its message is not for a guest.
      service().mockRejectedValue(new ApiError(500, 'An error occurred while processing your request'));

      await expect(invoke(setup())).rejects.toThrow();

      expect(errorActions()[0]).toEqual({ type: 'SET_ERROR', payload: { error: UNEXPECTED } });
    });

    it('never renders a Development stack trace into the cart', async () => {
      // `ExceptionHandlingMiddleware` puts `exception.ToString()` in errors[0] on a Development
      // build, and `getErrorMessage` prefers errors[0] over message.
      const trace = 'System.InvalidOperationException: Sequence contains no elements\n   at Basket...';
      service().mockRejectedValue(new ApiError(500, 'An error occurred', [trace]));

      await expect(invoke(setup())).rejects.toThrow();

      const shown = (errorActions()[0] as { payload: { error: string } }).payload.error;
      expect(shown).toBe(UNEXPECTED);
      expect(shown).not.toContain('InvalidOperationException');
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

  it('addItem rolls back rather than resyncing when the basket is gone', async () => {
    // Not a contract about the ADD endpoint — it uses GetOrCreateBasketAsync and the only other
    // basket-absent throw on that path is deliberately uncoded, so it cannot answer BasketNotFound.
    // What this pins is that the code-scoped recovery did not leak into `addItem`: it must report
    // and roll back like any other failure, never resync.
    mocked.addItemToBasket.mockRejectedValue(notFound('Basket not found', 'BasketNotFound'));

    await expect(setup().addItem({ productId: 'p1', quantity: 1 })).rejects.toThrow();

    expect(syncBasket).not.toHaveBeenCalled();
    expect(errorActions().map((a) => a.type)).toEqual(['SET_ERROR', 'ROLLBACK']);
  });
});
