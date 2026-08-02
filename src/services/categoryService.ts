import { apiClient } from '@/utils/apiClient';
import { compressImageForUpload } from '@/utils/imageCompression';
import type { Category } from '@/app/admin/menu-management/interfaces';

const CATEGORIES_API_URL = '/api/Categories';

interface CategoryData {
  name: string;
  description?: string;
  isActive: boolean;
  /**
   * OrderChannels bitmask; `null`/omitted = every order type. Build it with
   * `maskFromOrderTypes` from `@/utils/orderChannels` — the bit values are NOT the OrderType
   * enum's numeric values.
   */
  availableOrderTypes?: number | null;
}

// This interface is for the main update, without displayOrder
interface UpdateCategoryData extends CategoryData {
  id: string;
}

export const createCategory = async (categoryData: CategoryData & { displayOrder: number }) => {
  return await apiClient.post(CATEGORIES_API_URL, categoryData);
};

export const updateCategory = async (categoryId: string, categoryData: UpdateCategoryData) => {
  return await apiClient.put(`${CATEGORIES_API_URL}/${categoryId}`, categoryData);
};

export const reorderCategory = async (categoryId: string, displayOrder: number) => {
  const payload = {
    categoryOrders: [
      {
        categoryId: categoryId,
        displayOrder: displayOrder,
      },
    ],
  };
  return await apiClient.put(`${CATEGORIES_API_URL}/reorder`, payload);
};

export const deleteCategory = async (categoryId: string) => {
  return await apiClient.delete(`${CATEGORIES_API_URL}/${categoryId}`);
};

export const uploadCategoryImage = async (categoryId: string, imageFile: File) => {
  const formData = new FormData();
  formData.append('Image', await compressImageForUpload(imageFile));

  return await apiClient.putFormData(`${CATEGORIES_API_URL}/${categoryId}/image`, formData);
};

interface PaginatedCategories {
  items: Category[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * The full category list, as `/api/Categories` returns it.
 *
 * Non-2xx THROWS `ApiError` — it does not resolve to a degraded result. Callers must have an error
 * branch; every one of them does (the customer menu even has translated copy for it, in
 * `MenuContent`). This used to swallow the failure and return invented categories from a
 * localStorage mock, which is why the response was untyped: the mock's shape was not this one.
 */
export const getCategories = async (
  pageNumber: number = 1,
  pageSize: number = 100,
): Promise<{ success: boolean; message: string; data: PaginatedCategories; errors: unknown }> => {
  // Backend expects 'PageNumber' and 'PageSize' (PascalCase)
  const url = `${CATEGORIES_API_URL}?PageNumber=${pageNumber}&PageSize=${pageSize}`;
  return await apiClient.get(url);
};
