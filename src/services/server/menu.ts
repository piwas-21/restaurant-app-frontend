/**
 * Server flow — menu products + categories.
 * Split from `serverService.ts` (Sprint 2 frontend baseline ratchet).
 */

import { apiClient } from '@/utils/apiClient';
import { ApiResponse } from '@/types/reservation';

export interface Product {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  type: string;
  categories?: ProductCategoryLink[];
  primaryCategoryId?: string;
  imageUrl?: string;
  variations?: ProductVariation[];
}

export interface ProductCategoryLink {
  categoryId: string;
  categoryName: string;
  isPrimary: boolean;
}

export interface ProductVariation {
  id: string;
  name: string;
  priceModifier: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
}

export async function getMenuProducts(): Promise<Product[]> {
  const response = await apiClient.get<{ success: boolean; data: { items: Product[] } }>(
    '/api/Products?PageSize=100&isActive=true',
  );
  return response.data?.items || [];
}

export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get<ApiResponse<{ items: Category[]; totalCount: number }>>(
    '/api/Categories?PageNumber=1&PageSize=100',
  );
  // The endpoint occasionally returns a bare array instead of a paged result.
  if (response.data && 'items' in response.data) {
    return response.data.items || [];
  }
  return (response.data as unknown as Category[]) || [];
}
