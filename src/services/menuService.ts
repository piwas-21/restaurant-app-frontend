import { apiClient } from '@/utils/apiClient';
import { Product } from '@/app/admin/menu-management/interfaces';
import type { ProductTypeQuery } from '@/utils/productTypeFilter';
import type { OrderType } from '@/types/order';
// A product CAN carry a menu definition (that is what makes it a bundle), so the product-creation
// payload still references the bundle shape even though the bundle CALLS moved out.
import type { MenuDefinitionData } from './menuBundleService';

const API_BASE_URL = '/api';
const PRODUCTS_API_URL = `${API_BASE_URL}/Products`;

interface PaginatedProducts {
  items: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Interfaces for Product Creation
interface VariationData {
  name: string;
  description?: string;
  priceModifier: number;
  isActive: boolean;
  displayOrder: number;
}

interface ContentData {
  [languageCode: string]: {
    name: string;
    description: string;
  };
}

export interface CreateProductData {
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial?: boolean;
  preparationTimeMinutes?: number;
  type: string;
  allergens?: string[];
  displayOrder?: number;
  categoryIds: string[];
  primaryCategoryId: string | null;
  variations?: VariationData[];
  content?: ContentData;
  detailedIngredients?: any[];
  menuDefinition?: MenuDefinitionData;
}

export const getProducts = async (
  pageNumber: number = 1,
  pageSize: number = 10,
  categoryId?: string | null,
  typeQuery?: ProductTypeQuery,
  // The channel the guest is ordering through. Does NOT filter the list — the server keeps blocked
  // items visible and only resolves each row's `availability`, so the guest reads a reason, not a hole.
  requestedOrderType?: OrderType | null,
): Promise<{ success: boolean; message: string; data: PaginatedProducts; errors: any }> => {
  let url = `${PRODUCTS_API_URL}?Page=${pageNumber}&PageSize=${pageSize}`;
  if (categoryId) {
    url += `&CategoryId=${categoryId}`;
  }
  if (requestedOrderType) {
    url += `&RequestedOrderType=${encodeURIComponent(requestedOrderType)}`;
  }
  if (typeQuery?.type) {
    url += `&Type=${typeQuery.type}`;
  } else if (typeQuery?.includeMenus) {
    url += `&IncludeMenus=true`;
  }
  return (await apiClient.get(url)) as { success: boolean; message: string; data: PaginatedProducts; errors: any };
};

export const createProduct = async (productData: CreateProductData) => {
  try {
    return await apiClient.post(PRODUCTS_API_URL, productData);
  } catch (error) {
    console.error('Create Product Failed:', error);
    throw error;
  }
};

export const getProductById = async (productId: string) => {
  return await apiClient.get(`${PRODUCTS_API_URL}/${productId}`);
};

/**
 * Today's featured special for the menu banner.
 *
 * `requestedOrderType` drives the server's `availability` verdict (G7). Without it the banner is
 * structurally permissive — the server resolves against "no channel chosen", which is orderable by
 * design — so the guest could add a channel-blocked item straight from the hero, two clicks earlier
 * than the catalog card that refuses it.
 */
export const getFeaturedSpecial = async (requestedOrderType?: OrderType | null) => {
  try {
    const query = requestedOrderType ? `?RequestedOrderType=${encodeURIComponent(requestedOrderType)}` : '';
    return await apiClient.get(`${PRODUCTS_API_URL}/featured-special${query}`);
  } catch {
    // IGNORED ON PURPOSE, with one thing worth naming: this reports `success: true` on a FAILED
    // call, so "no special is configured" and "the call failed" are indistinguishable to the
    // caller. That is the intended trade — the hero is decorative, and a missing hero must never
    // fail the home page — but it means this endpoint can never be monitored from the client.
    return { success: true, data: null, message: 'No featured special available' };
  }
};
