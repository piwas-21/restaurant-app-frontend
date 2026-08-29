import { apiClient } from '@/utils/apiClient';
import { compressImageForUpload, compressImagesForUpload } from '@/utils/imageCompression';
import type { Product } from '@/app/admin/menu-management/interfaces';

const PRODUCTS_API_URL = '/api/Products';

export const uploadProductImage = async (
  productId: string,
  imageFile: File,
  altText: string,
  isPrimary: boolean,
  sortOrder: number,
) => {
  const formData = new FormData();
  formData.append('Image', await compressImageForUpload(imageFile));
  formData.append('AltText', altText);
  formData.append('IsPrimary', String(isPrimary));
  formData.append('SortOrder', String(sortOrder));

  return await apiClient.postFormData(`${PRODUCTS_API_URL}/${productId}/images`, formData);
};

export const getProductImages = async (productId: string) => {
  return await apiClient.get(`${PRODUCTS_API_URL}/${productId}/images`);
};

/** Admin quick-edit: update only a product's base price (PATCH /api/Products/{id}/price). */
export const updateProductPrice = async (productId: string, price: number) => {
  return await apiClient.patch<{ success: boolean; data: number; message?: string }>(
    `${PRODUCTS_API_URL}/${productId}/price`,
    { price },
  );
};

export const uploadBulkProductImages = async (productId: string, imageFiles: File[]) => {
  const formData = new FormData();
  const compressed = await compressImagesForUpload(imageFiles);
  compressed.forEach((file) => {
    formData.append('Images', file);
  });

  return await apiClient.postFormData(`${PRODUCTS_API_URL}/${productId}/images/bulk`, formData);
};

export const updateProduct = async (productId: string, productData: any) => {
  // A failed update must surface to the caller. It once resolved successfully from a localStorage
  // fixture instead, which made price edits appear saved while the backend rejected them.
  return await apiClient.put(`${PRODUCTS_API_URL}/${productId}`, productData);
};

export const updateProductImageDetails = async (productId: string, imageId: string, imageData: any) => {
  return await apiClient.put(`${PRODUCTS_API_URL}/${productId}/images/${imageId}`, imageData);
};

export const deleteProductImage = async (productId: string, imageId: string) => {
  return await apiClient.delete(`${PRODUCTS_API_URL}/${productId}/images/${imageId}`);
};

export const deleteProduct = async (productId: string) => {
  return await apiClient.delete(`${PRODUCTS_API_URL}/${productId}`);
};

// Special Products API Functions

export const getSpecialProducts = async (page: number = 1, pageSize: number = 20) => {
  // Backend expects 'Page' and 'PageSize' (PascalCase)
  return await apiClient.get(`${PRODUCTS_API_URL}/specials?Page=${page}&PageSize=${pageSize}`);
};

export const getFeaturedSpecial = async () => {
  return await apiClient.get(`${PRODUCTS_API_URL}/featured-special`);
};

export const setFeaturedSpecial = async (productId: string) => {
  return await apiClient.post(`${PRODUCTS_API_URL}/${productId}/set-featured`, {});
};

export const unsetFeaturedSpecial = async () => {
  return await apiClient.delete(`${PRODUCTS_API_URL}/featured-special`);
};

// Product Search

/**
 * The `GET /api/Products` envelope as the SEARCH callers read it.
 *
 * Every field is optional below `success` on purpose: a refusal arrives as **200 + `success: false`**
 * with `data: null` (`ProductsController` wraps `ApiResponse.Failure`), so a non-optional `data`
 * would type-check a read that crashes at runtime on the one path that matters.
 */
export interface ProductSearchResponse {
  success: boolean;
  message?: string;
  data?: {
    items?: Product[];
    totalCount?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
  errors?: unknown;
}

export interface ProductSearchOptions {
  /**
   * Opt into the OPTION-ONLY items (`Product.IsComponent`) the endpoint excludes by default, the
   * same param `getProducts` sends for the admin catalog. Only the BUNDLE option picker sets it:
   * an option-only item exists to be chosen inside a bundle, so it must be findable there and
   * nowhere else. The side-item picker deliberately leaves it unset.
   */
  includeComponents?: boolean;
}

/**
 * Server-side product search. `search` is implemented by `GetProductsQuery` and matches the
 * LOCALISED names too (`p.Descriptions.Any(c => c.Name...)`), which is why no caller may re-filter
 * the answer in the browser: a row the server matched on its Turkish name has no matching `name`.
 */
export const searchProducts = async (query: string, options?: ProductSearchOptions): Promise<ProductSearchResponse> => {
  // Appended only when asked, so every existing caller's request stays byte-identical. The casing
  // differs from `menuService`'s `IncludeComponents` for the same reason `search`/`pageSize` here
  // differ from its `Page`/`PageSize`: each call matches its own neighbours, and ASP.NET query
  // binding is case-insensitive — which is what already makes both spellings work on one endpoint.
  const componentsParam = options?.includeComponents ? '&includeComponents=true' : '';
  return (await apiClient.get(
    `${PRODUCTS_API_URL}?search=${encodeURIComponent(query)}&pageSize=20${componentsParam}`,
  )) as ProductSearchResponse;
};

// Menu Definition Management
export const updateMenuDefinition = async (productId: string, menuDefinition: any) => {
  return await apiClient.put(`${PRODUCTS_API_URL}/${productId}/menu-definition`, menuDefinition);
};
