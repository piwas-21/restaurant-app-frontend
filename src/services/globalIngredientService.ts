import { apiClient } from '@/utils/apiClient';

const GLOBAL_INGREDIENTS_API_URL = '/api/global-ingredients';

export interface CreateGlobalIngredientData {
  defaultName: string;
  imageUrl?: string;
  translations: {
    languageCode: string;
    name: string;
  }[];
}

export const createGlobalIngredient = async (data: CreateGlobalIngredientData) => {
  return await apiClient.post(GLOBAL_INGREDIENTS_API_URL, data);
};

export const searchGlobalIngredients = async (query: string, limit: number = 10) => {
  return await apiClient.get(`${GLOBAL_INGREDIENTS_API_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
};
