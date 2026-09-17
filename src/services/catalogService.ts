import { apiClient } from '@/utils/apiClient';
import type { OrderType } from '@/types/order';
import type { CatalogOfferFamilyResponse } from '@/types/menu/offerFamily';

const CATALOG_API_URL = '/api/Catalog';

export interface CatalogQuery {
  page?: number;
  pageSize?: number;
  categoryId?: string | null;
  requestedOrderType?: OrderType | null;
  signal?: AbortSignal;
}

/** Public catalogue aggregate; grouping and pagination stay server-owned. */
export async function getCatalogOfferFamilies(query: CatalogQuery = {}): Promise<CatalogOfferFamilyResponse> {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.requestedOrderType) params.set('requestedOrderType', query.requestedOrderType);
  const suffix = params.toString();
  const endpoint = suffix ? `${CATALOG_API_URL}?${suffix}` : CATALOG_API_URL;
  return query.signal
    ? apiClient.get<CatalogOfferFamilyResponse>(endpoint, { signal: query.signal })
    : apiClient.get<CatalogOfferFamilyResponse>(endpoint);
}
