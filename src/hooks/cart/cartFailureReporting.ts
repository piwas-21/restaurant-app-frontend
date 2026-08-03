import React from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { isServerFault } from '@/utils/basketMutationError';
import { CartAction, CartState } from '@/components/cart/cartTypes';

/**
 * What a failed cart mutation puts on screen.
 *
 * Split out of `useCartItemMutations` because explaining these two exits — which sentence is shown,
 * and in what order the actions must be dispatched for it to survive — takes more room than the
 * mutations themselves, and the hook has a 200-LOC budget.
 *
 * @param unexpectedError   already-translated sentence for a failure the server did not describe.
 * @param basketGoneError   already-translated sentence for a basket that no longer exists. Both are
 *                          resolved by the provider, which has a `t`; this module does not.
 */
export function createCartFailureReporters(
  dispatch: React.Dispatch<CartAction>,
  syncBasket: () => Promise<void>,
  unexpectedError: string,
  basketGoneError: string,
) {
  /**
   * A 5xx is answered with OUR words, checked before `getErrorMessage` because it would otherwise
   * win: that message describes an internal fault, and on a DEVELOPMENT build the middleware puts a
   * full stack trace in `errors[0]`, which `getErrorMessage` PREFERS over `message` (local-only —
   * both deployed boxes run Production). Neither belongs in a cart. This only became renderable
   * when the backend stopped answering failures with HTTP 200, so keeping the localized fallback is
   * what makes that change a fix rather than a swap of one bad sentence for another.
   *
   * Everything else shows what the server said — 4xx prose is often written FOR the guest, like the
   * channel guard's reason — or the translated fallback when it said nothing.
   */
  const displayMessage = (error: unknown): string =>
    (isServerFault(error) ? null : getErrorMessage(error)) ?? unexpectedError;

  /**
   * The basket row is gone. Show the cart as it really is, THEN say why.
   *
   * Order is load-bearing: `cartReducer`'s SYNC_BASKET arm sets `error: null`, so the sentence has
   * to be dispatched AFTER the resync or it is wiped by it. Rolling back instead would leave the
   * guest reading "your cart is empty or expired" above a full, itemised cart whose every tap fails
   * with no way out but a reload — the resync is what makes the screen and the server agree.
   *
   * This is the branch #415 is about. The resync itself was never the bug; doing it SILENTLY was.
   */
  const reportBasketGone = async (logLabel: string, error: unknown) => {
    await syncBasket();
    dispatch({ type: 'SET_ERROR', payload: { error: basketGoneError } });
    console.error(logLabel, error);
  };

  /**
   * Show the failure and roll back — the tail all three mutations share.
   *
   * Deliberately does NOT include the already-gone recovery. Folding that in here would have given
   * `addItem` a branch it never had, and a missing PRODUCT is a perfectly ordinary answer to an ADD
   * — it would have resynced the basket and swallowed the message instead of showing it. Update and
   * remove opt in explicitly; add does not.
   *
   * ROLLBACK is what makes the message survive: `cartReducer`'s ROLLBACK arm carries
   * `error: state.error` forward, unlike SYNC_BASKET.
   */
  const reportFailure = (previousState: CartState, logLabel: string, error: unknown) => {
    dispatch({ type: 'SET_ERROR', payload: { error: displayMessage(error) } });
    dispatch({ type: 'ROLLBACK', payload: { previousState } });
    console.error(logLabel, error);
  };

  return { reportFailure, reportBasketGone };
}
