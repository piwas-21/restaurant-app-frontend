import { BasketDto, BasketItemDto } from '@/types/basket';
import { SelectedMenuOption } from '@/types/menu';

/**
 * Extended cart item with backend basket item ID
 */
export interface CartItem extends BasketItemDto {
  basketItemId?: string; // Backend basket item ID for updates/deletes
}

/**
 * Cart state structure
 */
export interface CartState {
  items: CartItem[];
  basket: BasketDto | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
}

/**
 * Action payload types
 */
export interface SyncBasketPayload {
  basket: BasketDto;
}

export interface AddItemPayload {
  productId: string;
  productVariationId?: string;
  menuId?: string;
  quantity: number;
  specialInstructions?: string;
  selectedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
  selectedSideItems?: Array<{ id: string; quantity: number }>;
  // Full per-option customization (ingredientQuantities, specialInstructions, …) — the
  // AddToBasket contract carries it per option and the bundle modal collects it (issue #150).
  selectedMenuOptions?: SelectedMenuOption[];
}

export interface UpdateItemPayload {
  basketItemId: string;
  quantity: number;
  specialInstructions?: string;
}

export interface RemoveItemPayload {
  basketItemId: string;
}

export interface SetLoadingPayload {
  isLoading: boolean;
}

export interface SetSyncingPayload {
  isSyncing: boolean;
}

export interface SetErrorPayload {
  error: string | null;
}

/**
 * Cart actions
 */
export type CartAction =
  | { type: 'SYNC_BASKET'; payload: SyncBasketPayload }
  | { type: 'SET_LOADING'; payload: SetLoadingPayload }
  | { type: 'SET_SYNCING'; payload: SetSyncingPayload }
  | { type: 'SET_ERROR'; payload: SetErrorPayload }
  | { type: 'OPTIMISTIC_ADD'; payload: CartItem }
  | { type: 'OPTIMISTIC_UPDATE'; payload: UpdateItemPayload }
  | { type: 'OPTIMISTIC_REMOVE'; payload: RemoveItemPayload }
  | { type: 'ROLLBACK'; payload: { previousState: CartState } };

/**
 * Cart context type
 */
export interface CartContextType {
  state: CartState;
  /**
   * Drop the current failure sentence.
   *
   * `state.error` is ONE slot written by six places (mount sync, clear, both promo actions, and the
   * two item-mutation reporters) and cleared by exactly one reducer arm, SYNC_BASKET. That was
   * survivable while only the legacy `/cart` route rendered it; the cart surfaces on `/menu` render
   * it too now, and `CartProvider` sits in the root layout and never remounts on client-side
   * navigation — so without this a bad promo code entered on `/cart` follows the guest to `/menu`
   * and sits in the sidebar until their next SUCCESSFUL cart write. Must be referentially stable:
   * consumers call it from a mount effect, and an unmemoized one would re-run every render and wipe
   * live errors before they could be read.
   */
  clearError: () => void;
  syncBasket: () => Promise<void>;
  addItem: (payload: AddItemPayload) => Promise<void>;
  updateItem: (basketItemId: string, quantity: number, specialInstructions?: string) => Promise<void>;
  removeItem: (basketItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyPromoCode: (promoCode: string) => Promise<void>;
  removePromoCode: () => Promise<void>;
  getItemCount: () => number;
  getTotal: () => number;
}
