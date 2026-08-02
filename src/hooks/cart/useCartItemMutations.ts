'use client';

import React from 'react';
import { basketService } from '@/services/basketService';
import { getErrorMessage } from '@/utils/apiClient';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { AddItemPayload, CartAction, CartState } from '@/components/cart/cartTypes';

interface CartItemMutations {
  addItem: (payload: AddItemPayload) => Promise<void>;
  updateItem: (basketItemId: string, quantity: number, specialInstructions?: string) => Promise<void>;
  removeItem: (basketItemId: string) => Promise<void>;
}

/**
 * The optimistic basket-item mutations (add / update / remove) for CartProvider. Each applies an
 * optimistic dispatch, calls the backend, syncs from the server response, and rolls back on error.
 * Extracted verbatim from CartContext (Sprint 6 god-file decomposition); behaviour unchanged.
 * `syncBasket` is passed in because update/remove re-sync on a not-found (item removed in another tab).
 */
/**
 * Did the server say the item is already gone?
 *
 * Matched on the SERVER's message ONLY. `getErrorMessage` returns null when the server authored
 * nothing, and the caller substitutes a translated fallback — matching that would make this branch
 * fire on whatever words a locale happens to use, silently turning a real failure into a
 * "someone else already removed it" resync.
 */
function isAlreadyGone(serverMessage: string | null): boolean {
  const message = serverMessage?.toLowerCase();
  return !!message && (message.includes('not found') || message.includes('basket item not found'));
}

export function useCartItemMutations(
  state: CartState,
  dispatch: React.Dispatch<CartAction>,
  ensureSession: () => void,
  syncBasket: () => Promise<void>,
  /**
   * Already-translated sentence for a failure the server did not describe. Passed in rather than
   * resolved here: `getErrorMessage` returns `null` for those now, and this hook has no `t` — the
   * provider does. Threading it is what stops the English literal reappearing inside the cart.
   */
  unexpectedError: string,
): CartItemMutations {
  /**
   * Show the failure and roll back — the tail all three mutations share.
   *
   * Deliberately does NOT include the already-gone recovery. Folding that in here would have given
   * `addItem` a branch it never had, and "not found" is a perfectly ordinary answer to an ADD
   * ("Product not found") — it would have resynced the basket and swallowed the message instead of
   * showing it. Update and remove opt in explicitly; add does not.
   */
  const reportFailure = (serverMessage: string | null, previousState: CartState, logLabel: string, error: unknown) => {
    dispatch({ type: 'SET_ERROR', payload: { error: serverMessage ?? unexpectedError } });
    dispatch({ type: 'ROLLBACK', payload: { previousState } });
    console.error(logLabel, error);
  };

  /**
   * Add item to basket
   */
  const addItem = async (payload: AddItemPayload) => {
    // Ensure session exists
    ensureSession();

    // Save previous state for rollback
    const previousState = { ...state };

    try {
      // Optimistic update (show immediately in UI)
      dispatch({
        type: 'OPTIMISTIC_ADD',
        payload: {
          productId: payload.productId,
          quantity: payload.quantity,
          unitPrice: 0, // Will be updated from server
          itemTotal: 0,
          specialInstructions: payload.specialInstructions,
        },
      });

      // Call backend
      const updatedBasket = await basketService.addItemToBasket(payload);

      // Sync with server response
      dispatch({ type: 'SYNC_BASKET', payload: { basket: updatedBasket } });

      // Fire only after the backend has confirmed the add (rollback path
      // below skips this). One event per genuine add — callers invoke
      // addItem once per user click, so no debouncing needed here.
      trackEvent('cart_item_added', {
        productId: payload.productId,
        quantity: payload.quantity,
        loggedIn: isLoggedInForAnalytics(),
      });
    } catch (error) {
      reportFailure(getErrorMessage(error), previousState, 'Error adding item to basket:', error);
      throw error; // Re-throw for component-level error handling
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  /**
   * Update item in basket
   */
  const updateItem = async (basketItemId: string, quantity: number, specialInstructions?: string) => {
    const previousState = { ...state };

    try {
      // Optimistic update
      dispatch({
        type: 'OPTIMISTIC_UPDATE',
        payload: { basketItemId, quantity, specialInstructions },
      });

      // Call backend
      const updatedBasket = await basketService.updateBasketItem(basketItemId, {
        quantity,
        specialInstructions,
      });

      // Sync with server response
      dispatch({ type: 'SYNC_BASKET', payload: { basket: updatedBasket } });
    } catch (error) {
      const serverMessage = getErrorMessage(error);
      // The item is already gone — someone removed it in another tab. Resync rather than report.
      if (isAlreadyGone(serverMessage)) {
        await syncBasket();
        return;
      }
      reportFailure(serverMessage, previousState, 'Error updating basket item:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  /**
   * Remove item from basket
   */
  const removeItem = async (basketItemId: string) => {
    const previousState = { ...state };

    try {
      // Optimistic update
      dispatch({
        type: 'OPTIMISTIC_REMOVE',
        payload: { basketItemId },
      });

      // Call backend
      const updatedBasket = await basketService.removeItemFromBasket(basketItemId);

      // Sync with server response
      dispatch({ type: 'SYNC_BASKET', payload: { basket: updatedBasket } });
    } catch (error) {
      const serverMessage = getErrorMessage(error);
      // The item is already gone — someone removed it in another tab. Resync rather than report.
      if (isAlreadyGone(serverMessage)) {
        await syncBasket();
        return;
      }
      reportFailure(serverMessage, previousState, 'Error removing basket item:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  return { addItem, updateItem, removeItem };
}
