/**
 * Basket API Type Definitions
 *
 * These types match the backend API DTOs for the Basket endpoints.
 * Backend API: http://localhost:5221/api/Basket
 */
import type { OrderType } from '@/types/order';

/**
 * Menu item summary included in basket items for menu orders
 */
export interface MenuItemSummaryDto {
  productId?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  categoryName?: string;
  quantity?: number;
  unitPrice?: number;
}

/**
 * Side item in basket
 */
export interface BasketSideItemDto {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  subTotal: number;
}

/**
 * Individual item in the basket
 */
export interface BasketItemDto {
  id?: string; // Backend basket item ID (required for updates/deletes)
  productId?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  productVariationId?: string;
  variationName?: string;
  menuId?: string;
  menuName?: string;
  variationContent?: Record<
    string,
    {
      name: string;
      description?: string;
    }
  >;
  menuDate?: string;
  menuItems?: MenuItemSummaryDto[];
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  specialInstructions?: string;
  // Customization fields for optional ingredients
  selectedIngredients?: string[]; // IDs of selected optional ingredients
  addedIngredients?: string[]; // IDs of optional ingredients added
  ingredientQuantities?: Record<string, number>; // Quantity for each optional ingredient
  customizationPrice?: number; // Additional price from customizations
  // Ingredient names for display purposes
  selectedIngredientNames?: string[];
  addedIngredientNames?: string[];
  // Selected side items with quantities
  selectedSideItems?: BasketSideItemDto[];
  // Child items for menu bundles (hierarchical structure)
  childItems?: BasketItemDto[];
}

/**
 * Complete basket data
 */
export interface BasketDto {
  id: string;
  userId?: string;
  sessionId?: string;
  subTotal: number;
  tax: number;
  deliveryFee: number;
  discount: number; // Promo code discount
  customerDiscount: number; // Customer-specific discount
  customerDiscountName?: string; // Name of the applied customer discount
  total: number;
  promoCode?: string;
  totalItems: number;
  expiresAt?: string;
  notes?: string;
  /**
   * The channel this basket is being ordered through, as the SERVER has it — `null`/absent means
   * none set, which is permissive (ORDER-TYPE-AVAILABILITY-PLAN §9.13).
   *
   * The point of the field is that the client can now RECONCILE rather than assume. Before it, the
   * only record of what the server had accepted was a local ref, so an assert that the server
   * refused (conflicting lines) was remembered as done — and `BasketChannelGuard` stayed disarmed
   * for the rest of the session with nothing able to notice.
   *
   * Optional: absent against a backend that predates §9.13, where it reads the same as "not set".
   */
  orderType?: OrderType | null;
  items: BasketItemDto[];
}

/**
 * Basket summary (lightweight version for cart counter)
 */
export interface BasketSummaryDto {
  id: string;
  itemCount: number;
  total: number;
}

/**
 * Request to add item to basket
 */
export interface AddToBasketDto {
  productId: string;
  productVariationId?: string;
  menuId?: string;
  quantity: number;
  specialInstructions?: string;
  selectedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
  selectedSideItems?: Array<{ id: string; quantity: number }>;
  selectedMenuOptions?: Array<{
    sectionId: string;
    itemId: string;
    quantity: number;
    specialInstructions?: string;
    selectedIngredients?: string[];
    ingredientQuantities?: Record<string, number>;
  }>;
}

/**
 * Request to update basket item
 */
export interface UpdateBasketItemDto {
  quantity: number;
  specialInstructions?: string;
}

/**
 * Request to apply promo code
 */
export interface ApplyPromoCodeRequest {
  promoCode: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

/**
 * Basket API response types
 */
export type BasketDtoApiResponse = ApiResponse<BasketDto>;
export type BasketSummaryDtoApiResponse = ApiResponse<BasketSummaryDto>;
