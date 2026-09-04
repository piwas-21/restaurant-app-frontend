import { apiClient } from '@/utils/apiClient';
import { compressImageForUpload } from '@/utils/imageCompression';
import type { Category } from '@/app/admin/menu-management/interfaces';

const CATEGORIES_API_URL = '/api/Categories';

interface CategoryData {
  name: string;
  /**
   * `string | null`, not `string | undefined` (#642): `UpdateCategoryCommand.Description` is
   * `string?` and the PUT is a FULL REPLACE that assigns the column unconditionally, so BOTH
   * spellings of "no description" are legal on the wire and both mean the same thing here. Typing
   * it as `string | undefined` is what forced the two category modals to coalesce before they
   * could call this, and a coalesce in a caller is a rule nobody can see from the schema.
   */
  description?: string | null;
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

/** The subset of a category a channel write has to echo back. */
export interface CategoryChannelEcho {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

/**
 * THE writer for a category's order-type mask. Every surface that changes what a category can be
 * ordered through goes through this one function — the admin matrix under restaurant settings and
 * the pinned quick toggle on the admin/cashier/server screens.
 *
 * It exists because of §9.1: `UpdateCategoryCommand` is a FULL-REPLACE PUT that assigns
 * name/description/isActive/availableOrderTypes unconditionally, so a caller that omits any of them
 * blanks it. Echoing them is not optional, and a second hand-rolled copy of that payload is exactly
 * how the field got wiped the first time. `displayOrder` is deliberately NOT sent: the handler never
 * assigns it (`ReorderCategoriesCommand` owns ordering), so omitting that one is safe.
 *
 * ⚠️ `[RequireAdmin]` on `PUT /api/Categories/{id}` — a Cashier or Server token gets a 403 here.
 */
export const updateCategoryOrderTypes = async (category: CategoryChannelEcho, availableOrderTypes: number | null) => {
  return await updateCategory(category.id, {
    id: category.id,
    name: category.name,
    description: category.description ?? undefined,
    isActive: category.isActive,
    availableOrderTypes,
  });
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
