import type { ApiResponse } from '@/types/order/common';
import { apiClient } from '@/utils/apiClient';

export interface ProductParentBundleReference {
  sectionId: string;
  productVariationId: string | null;
}

export interface ProductParentBundle {
  id: string;
  name: string;
  isActive: boolean;
  references: ProductParentBundleReference[];
}

export interface ProductParentBundles {
  items: ProductParentBundle[];
}

export const getProductParentBundles = async (
  productId: string,
  signal?: AbortSignal,
): Promise<ApiResponse<ProductParentBundles>> => {
  const path = `/api/Products/${encodeURIComponent(productId)}/parent-bundles`;
  return apiClient.get<ApiResponse<ProductParentBundles>>(path, signal ? { signal } : undefined);
};
