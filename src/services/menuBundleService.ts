import { apiClient } from '@/utils/apiClient';

/**
 * The `/api/Menus` half of what used to be one `menuService.ts`.
 *
 * Split out because that file sat at 199/200 LOC and G7 needed to add a query parameter to a
 * PRODUCTS call — so the seam had to be cut somewhere, and Products vs Menus is the seam the file
 * already had: two API roots, no shared helpers, and no caller that wants both halves.
 *
 * `getMenuBundles` did not come across: it had zero importers anywhere in the tree (no barrel, no
 * namespace import, not in the mock client or the e2e suite), so moving it would have carried dead
 * surface area into a brand-new file. The admin list uses `getProducts` with a type filter and the
 * customer list uses `getPublicMenuBundles`.
 */
const MENUS_API_URL = '/api/Menus';

export { MENUS_API_URL };

export interface MenuSectionItemData {
  productId: string;
  additionalPrice: number;
  displayOrder: number;
  isDefault: boolean;
}

export interface MenuSectionData {
  name: string;
  description?: string;
  displayOrder: number;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  items: MenuSectionItemData[];
}

export interface MenuDefinitionData {
  isAlwaysAvailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
  availableMonday: boolean;
  availableTuesday: boolean;
  availableWednesday: boolean;
  availableThursday: boolean;
  availableFriday: boolean;
  availableSaturday: boolean;
  availableSunday: boolean;
  sections: MenuSectionData[];
}

export const createMenuBundle = async (menuData: unknown) => {
  try {
    return await apiClient.post(MENUS_API_URL, menuData);
  } catch (error) {
    console.error('Create Menu Bundle Failed:', error);
    throw error;
  }
};

export const updateMenuBundle = async (id: string, menuData: unknown) => {
  try {
    return await apiClient.put(`${MENUS_API_URL}/${id}`, menuData);
  } catch (error) {
    console.error('Update Menu Bundle Failed:', error);
    throw error;
  }
};

export const getMenuBundleById = async (id: string) => {
  try {
    return await apiClient.get(`${MENUS_API_URL}/${id}`);
  } catch (error) {
    console.error('Get Menu Bundle Failed:', error);
    throw error;
  }
};

export const deleteMenuBundle = async (id: string) => {
  try {
    return await apiClient.delete(`${MENUS_API_URL}/${id}`);
  } catch (error) {
    console.error('Delete Menu Bundle Failed:', error);
    throw error;
  }
};

/** Public (customer) bundle list — active + available only. */
export const getPublicMenuBundles = async (page: number = 1, pageSize: number = 10) => {
  try {
    return await apiClient.get(`${MENUS_API_URL}?page=${page}&pageSize=${pageSize}`);
  } catch (error) {
    console.error('Get Public Menu Bundles Failed:', error);
    throw error;
  }
};
