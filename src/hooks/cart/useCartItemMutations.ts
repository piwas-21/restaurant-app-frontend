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
export function useCartItemMutations(
  state: CartState,
  dispatch: React.Dispatch<CartAction>,
  ensureSession: () => void,
  syncBasket: () => Promise<void>,
): CartItemMutations {
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
      const errorMessage = getErrorMessage(error);
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      dispatch({ type: 'ROLLBACK', payload: { previousState } });
      console.error('Error adding item to basket:', error);
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
      const errorMessage = getErrorMessage(error);

      // If item was already removed (not found), refresh the cart
      // This handles the case where the item was removed in another tab
      if (
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('basket item not found')
      ) {
        await syncBasket();
        return; // Don't throw error or rollback
      }

      // For other errors, rollback and show error
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      dispatch({ type: 'ROLLBACK', payload: { previousState } });
      console.error('Error updating basket item:', error);
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
      const errorMessage = getErrorMessage(error);

      // If item was already removed (not found), keep the optimistic update
      // This handles the case where the item was removed in another tab
      if (
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('basket item not found')
      ) {
        // Refresh the cart to get the latest state from the server
        await syncBasket();
        return; // Don't throw error or rollback
      }

      // For other errors, rollback and show error
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      dispatch({ type: 'ROLLBACK', payload: { previousState } });
      console.error('Error removing basket item:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  return { addItem, updateItem, removeItem };
}
