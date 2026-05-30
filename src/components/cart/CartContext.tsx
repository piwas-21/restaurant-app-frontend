'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { basketService } from '@/services/basketService';
import { useSessionContext } from '@/contexts/SessionContext';
import { getErrorMessage } from '@/utils/apiClient';
import { useCartItemMutations } from '@/hooks/cart/useCartItemMutations';
import { CartContextType } from './cartTypes';
import { initialState, cartReducer } from './cartReducer';

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * Cart Provider Component. State + reducer live in cartReducer; the optimistic item mutations
 * (add/update/remove) live in the useCartItemMutations hook. The provider owns sync, clear, and
 * promo-code operations plus the on-mount sync, and assembles the context value.
 */
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const { sessionId, ensureSession } = useSessionContext();

  /**
   * Sync basket from backend
   */
  const syncBasket = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

      const basket = await basketService.getBasket();

      if (basket) {
        dispatch({ type: 'SYNC_BASKET', payload: { basket } });
      } else {
        // Empty basket
        dispatch({ type: 'SYNC_BASKET', payload: { basket: { ...initialState.basket!, items: [] } } });
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      console.error('Error syncing basket:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  };

  const { addItem, updateItem, removeItem } = useCartItemMutations(state, dispatch, ensureSession, syncBasket);

  /**
   * Clear entire basket
   */
  const clearCart = async () => {
    const previousState = { ...state };

    try {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: true } });

      // Call backend
      const updatedBasket = await basketService.clearBasket();

      // Sync with server response
      dispatch({ type: 'SYNC_BASKET', payload: { basket: updatedBasket } });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      dispatch({ type: 'ROLLBACK', payload: { previousState } });
      console.error('Error clearing basket:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  /**
   * Apply promo code to basket
   */
  const applyPromoCode = async (promoCode: string) => {
    const previousState = { ...state };

    try {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: true } });

      // Call backend
      const updatedBasket = await basketService.applyPromoCode(promoCode);

      // Sync with server response
      dispatch({ type: 'SYNC_BASKET', payload: { basket: updatedBasket } });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      dispatch({ type: 'ROLLBACK', payload: { previousState } });
      console.error('Error applying promo code:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  /**
   * Remove promo code from basket
   */
  const removePromoCode = async () => {
    const previousState = { ...state };

    try {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: true } });

      // Call backend
      const updatedBasket = await basketService.removePromoCode();

      // Sync with server response
      dispatch({ type: 'SYNC_BASKET', payload: { basket: updatedBasket } });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      dispatch({ type: 'ROLLBACK', payload: { previousState } });
      console.error('Error removing promo code:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: { isSyncing: false } });
    }
  };

  /**
   * Get total item count
   */
  const getItemCount = (): number => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  /**
   * Get cart total (from backend basket)
   */
  const getTotal = (): number => {
    return state.basket?.total || 0;
  };

  // Sync basket from backend on mount (when session is ready)
  useEffect(() => {
    if (sessionId) {
      // syncBasket has its own try/catch (dispatches error state); fire-and-forget.
      void syncBasket();
    }
  }, [sessionId]);

  const value: CartContextType = {
    state,
    syncBasket,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    applyPromoCode,
    removePromoCode,
    getItemCount,
    getTotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/**
 * Hook to use cart context
 */
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
