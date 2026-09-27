import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuAuthoringApiResponse } from '@/types/menuAuthoringSearch';
import { apiClient, getErrorMessage } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';

export async function getOptionSetTargetProduct(productId: string): Promise<ProductDetails> {
  const response = await apiClient.get<MenuAuthoringApiResponse<ProductDetails>>(
    `/api/Products/${encodeURIComponent(productId)}`,
    { requireAuth: true },
  );
  if (!response.success || response.data === undefined) throwServerRefusal(response);
  return response.data;
}

export async function getOptionSetTargetProducts(productIds: readonly string[]) {
  const unique = [...new Set(productIds)];
  const loaded: Record<string, ProductDetails> = {};
  const failed: Record<string, string> = {};
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, unique.length) }, async () => {
      while (index < unique.length) {
        const productId = unique[index++];
        try {
          loaded[productId] = await getOptionSetTargetProduct(productId);
        } catch (error) {
          failed[productId] = getErrorMessage(error) ?? 'option_set_target_load_error';
        }
      }
    }),
  );
  return { loaded, failed };
}
