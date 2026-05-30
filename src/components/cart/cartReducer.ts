import { BasketDto } from '@/types/basket';
import { CartItem, CartState, CartAction } from './cartTypes';

/**
 * Initial state
 */
export const initialState: CartState = {
  items: [],
  basket: null,
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSyncedAt: null,
};

/**
 * Convert BasketDto to CartItem array
 */
export function basketToCartItems(basket: BasketDto | null): CartItem[] {
  if (!basket || !basket.items) return [];

  return basket.items.map((item) => ({
    ...item,
    basketItemId: item.id, // Store backend ID for updates/deletes
  }));
}

/**
 * Cart reducer
 */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SYNC_BASKET':
      return {
        ...state,
        basket: action.payload.basket,
        items: basketToCartItems(action.payload.basket),
        lastSyncedAt: Date.now(),
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    case 'SET_SYNCING':
      return {
        ...state,
        isSyncing: action.payload.isSyncing,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
        isSyncing: false,
      };

    case 'OPTIMISTIC_ADD':
      // Optimistically add item to cart (will be replaced by server response)
      return {
        ...state,
        items: [...state.items, action.payload],
        isSyncing: true,
      };

    case 'OPTIMISTIC_UPDATE':
      // Optimistically update item quantity
      return {
        ...state,
        items: state.items.map((item) =>
          item.basketItemId === action.payload.basketItemId
            ? { ...item, quantity: action.payload.quantity, specialInstructions: action.payload.specialInstructions }
            : item,
        ),
        isSyncing: true,
      };

    case 'OPTIMISTIC_REMOVE':
      // Optimistically remove item from cart
      return {
        ...state,
        items: state.items.filter((item) => item.basketItemId !== action.payload.basketItemId),
        isSyncing: true,
      };

    case 'ROLLBACK':
      // Rollback to previous state on error
      return {
        ...action.payload.previousState,
        error: state.error, // Keep the error message
        isSyncing: false,
      };

    default:
      return state;
  }
}
