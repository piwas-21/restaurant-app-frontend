'use client';

import React from 'react';
import { basketService } from '@/services/basketService';
import { isBasketGone, isBasketItemAlreadyGone } from '@/utils/basketMutationError';
import { createCartFailureReporters } from '@/hooks/cart/cartFailureReporting';
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
  /**
   * Already-translated sentence for a basket that no longer exists, threaded for the same reason.
   * Replaces the server's own words here rather than falling back to them: "Basket not found" is an
   * internal description, and this is the one cart failure with a guest-facing sentence already
   * written for it in all ten locales.
   */
  basketGoneError: string,
): CartItemMutations {
  // Which sentence each failure shows, and the dispatch order that makes it survive, live in
  // `cartFailureReporting` — see there before changing any error path here.
  const { reportFailure, reportBasketGone } = createCartFailureReporters(
    dispatch,
    syncBasket,
    unexpectedError,
    basketGoneError,
  );

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
      reportFailure(previousState, 'Error adding item to basket:', error);
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
      // The ITEM is already gone — someone removed it in another tab. Resync rather than report.
      // Scoped to that one error code on purpose: a BASKET-level not-found is the same 404 and must
      // NOT come down here, or the resync silently empties the whole cart (#415).
      if (isBasketItemAlreadyGone(error)) {
        await syncBasket();
        return;
      }
      if (isBasketGone(error)) {
        await reportBasketGone('Error updating basket item:', error);
        throw error;
      }
      reportFailure(previousState, 'Error updating basket item:', error);
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
      // See the note on `updateItem` — same 404 pair, same reason this is code-scoped.
      if (isBasketItemAlreadyGone(error)) {
        await syncBasket();
        return;
      }
      if (isBasketGone(error)) {
        await reportBasketGone('Error removing basket item:', error);
        throw error;
      }
      reportFailure(previousState, 'Error removing basket item:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  return { addItem, updateItem, removeItem };
}
