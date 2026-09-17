'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getCatalogOfferFamilies } from '@/services/catalogService';
import type { CatalogOfferFamily, CatalogOfferFamilyDto } from '@/types/menu/offerFamily';
import { mapCatalogOfferFamilyDto } from '@/utils/offerFamily';
import { errorMessage } from '@/hooks/publicMenu/pipeline';

// The current Catalog endpoint caps PageSize at 100. Fetching the remaining pages here keeps the
// public family path complete for larger tenants while preserving one filterable in-memory list.
export const OFFER_FAMILY_PAGE_SIZE = 100;

interface CatalogPageShape {
  items?: CatalogOfferFamilyDto[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface UsePublicOfferFamiliesReturn {
  families: CatalogOfferFamily[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  refetch: () => Promise<void>;
}

function readPage(response: Awaited<ReturnType<typeof getCatalogOfferFamilies>>): CatalogPageShape {
  if (Array.isArray(response.data)) return { items: response.data };
  if (response.data && typeof response.data === 'object') return response.data;
  return { items: response.items, totalCount: response.totalCount };
}

/** Loads the server-grouped public offer families for the categoryOffers presentation path. */
export function usePublicOfferFamilies(enabled: boolean): UsePublicOfferFamiliesReturn {
  const { state: orderTypeState, hydrated: orderTypeHydrated } = useOrderType();
  const orderType = orderTypeState.orderType;
  const [families, setFamilies] = useState<CatalogOfferFamily[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFamilies = useCallback(async (requestedOrderType?: typeof orderType) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const localId = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCatalogOfferFamilies({
        page: 1,
        pageSize: OFFER_FAMILY_PAGE_SIZE,
        requestedOrderType,
        signal: controller.signal,
      });
      if (localId !== requestId.current) return;
      if (response.success === false) {
        setFamilies([]);
        setError(errorMessage(response.message, 'Failed to fetch menu offers'));
        return;
      }
      const page = readPage(response);
      const resolvedPageSize = page.pageSize ?? OFFER_FAMILY_PAGE_SIZE;
      const totalPageCount = Math.max(
        1,
        page.totalPages ?? Math.ceil((page.totalCount ?? page.items?.length ?? 0) / resolvedPageSize),
      );
      const allItems = [...(page.items ?? [])];
      for (let currentPage = 2; currentPage <= totalPageCount; currentPage += 1) {
        const nextResponse = await getCatalogOfferFamilies({
          page: currentPage,
          pageSize: OFFER_FAMILY_PAGE_SIZE,
          requestedOrderType,
          signal: controller.signal,
        });
        if (localId !== requestId.current) return;
        if (nextResponse.success === false) {
          throw new Error(errorMessage(nextResponse.message, 'Failed to fetch menu offers'));
        }
        allItems.push(...(readPage(nextResponse).items ?? []));
      }
      setFamilies(allItems.map(mapCatalogOfferFamilyDto).filter(isFamily));
      setCurrentPage(page.page ?? 1);
      setTotalPages(totalPageCount);
      setTotalCount(page.totalCount ?? allItems.length);
    } catch (error_: unknown) {
      if (controller.signal.aborted || localId !== requestId.current) return;
      setFamilies([]);
      setError(errorMessage(error_, 'Failed to fetch menu offers'));
    } finally {
      if (!controller.signal.aborted && localId === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !orderTypeHydrated) {
      requestId.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      setIsLoading(false);
      return;
    }
    void fetchFamilies(orderType);
    return () => {
      requestId.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [enabled, orderType, orderTypeHydrated, fetchFamilies]);

  const refetch = useCallback(async () => {
    await fetchFamilies(orderType);
  }, [fetchFamilies, orderType]);

  return { families, isLoading, error, currentPage, totalPages, totalCount, pageSize: OFFER_FAMILY_PAGE_SIZE, refetch };
}

function isFamily(value: CatalogOfferFamily | null): value is CatalogOfferFamily {
  return value !== null;
}
