import { BasketDto, BasketItemDto } from '@/types/basket';

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
  excludedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
  selectedSideItems?: Array<{ id: string; quantity: number }>;
  selectedMenuOptions?: Array<{ sectionId: string; itemId: string; quantity: number }>;
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
