'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getCatalogOfferFamilies } from '@/services/catalogService';
import type { CatalogOfferFamily, CatalogOfferFamilyDto } from '@/types/menu/offerFamily';
import { mapCatalogOfferFamilyDto } from '@/utils/offerFamily';
import { errorMessage } from '@/hooks/publicMenu/pipeline';
import type { PublicMenuClientData } from '@/types/publicDiscovery';
import { currentPublicOfferPage, updatePublicOfferPageUrl } from './publicMenu/publicOfferFamilyUrl';

// The current Catalog endpoint caps PageSize at 100. The guest path renders one server page at a
// time so a growing tenant catalogue cannot be materialized into one browser request.
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
  onPageChange: (page: number) => void;
  refetch: () => Promise<void>;
}

function readPage(response: Awaited<ReturnType<typeof getCatalogOfferFamilies>>): CatalogPageShape {
  if (Array.isArray(response.data)) return { items: response.data };
  if (response.data && typeof response.data === 'object') return response.data;
  return { items: response.items, totalCount: response.totalCount };
}

/** Loads the server-grouped public offer families for the categoryOffers presentation path. */
export function usePublicOfferFamilies(
  enabled: boolean,
  categoryId: string | null = null,
  initialSnapshot?: PublicMenuClientData,
): UsePublicOfferFamiliesReturn {
  const { state: orderTypeState, hydrated: orderTypeHydrated } = useOrderType();
  const orderType = orderTypeState.orderType;
  const [families, setFamilies] = useState<CatalogOfferFamily[]>(initialSnapshot?.offerFamilies ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialSnapshot?.offerPage.currentPage ?? 1);
  const [totalPages, setTotalPages] = useState(initialSnapshot?.offerPage.totalPages ?? 1);
  const [totalCount, setTotalCount] = useState(initialSnapshot?.offerPage.totalCount ?? 0);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const orderTypeRef = useRef(orderType);

  useEffect(() => {
    orderTypeRef.current = orderType;
  }, [orderType]);

  const fetchFamilies = useCallback(
    async (requestedPage: number, requestedOrderType?: typeof orderType) => {
      const pageNumber = Math.max(1, Math.trunc(requestedPage));
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const localId = ++requestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const response = await getCatalogOfferFamilies({
          page: pageNumber,
          pageSize: OFFER_FAMILY_PAGE_SIZE,
          categoryId,
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
        const resolvedPage = Math.min(Math.max(1, page.page ?? pageNumber), totalPageCount);
        const mappedFamilies = (page.items ?? []).map(mapCatalogOfferFamilyDto).filter(isFamily);
        if (resolvedPage !== pageNumber) updatePublicOfferPageUrl(resolvedPage, false);
        currentPageRef.current = resolvedPage;
        totalPagesRef.current = totalPageCount;
        setFamilies(mappedFamilies);
        setCurrentPage(resolvedPage);
        setTotalPages(totalPageCount);
        setTotalCount(page.totalCount ?? mappedFamilies.length);
      } catch (error_: unknown) {
        if (controller.signal.aborted || localId !== requestId.current) return;
        setFamilies([]);
        setError(errorMessage(error_, 'Failed to fetch menu offers'));
      } finally {
        if (!controller.signal.aborted && localId === requestId.current) setIsLoading(false);
      }
    },
    [categoryId],
  );

  useEffect(() => {
    if (!enabled || !orderTypeHydrated) {
      requestId.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      setIsLoading(false);
      return;
    }
    const routePage = currentPublicOfferPage(categoryId);
    const page = routePage ?? (currentPageRef.current === 1 ? (initialSnapshot?.offerPage.currentPage ?? 1) : 1);
    currentPageRef.current = page;
    totalPagesRef.current = initialSnapshot?.offerPage.totalPages ?? 1;
    void fetchFamilies(page, orderType);
    return () => {
      requestId.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [enabled, orderType, orderTypeHydrated, fetchFamilies, initialSnapshot, categoryId]);

  const onPageChange = useCallback(
    (requestedPage: number) => {
      if (
        !enabled ||
        !Number.isInteger(requestedPage) ||
        requestedPage < 1 ||
        requestedPage > totalPagesRef.current ||
        requestedPage === currentPageRef.current
      ) {
        return;
      }
      updatePublicOfferPageUrl(requestedPage, true);
      void fetchFamilies(requestedPage, orderTypeRef.current);
    },
    [enabled, fetchFamilies],
  );

  const refetch = useCallback(async () => {
    await fetchFamilies(currentPageRef.current, orderTypeRef.current);
  }, [fetchFamilies]);

  useEffect(() => {
    const restorePageFromHistory = () => {
      if (!enabled) return;
      const requestedPage = currentPublicOfferPage(categoryId);
      if (requestedPage === null) return;
      const page = Math.min(requestedPage, totalPagesRef.current);
      if (page !== requestedPage) updatePublicOfferPageUrl(page, false);
      void fetchFamilies(page, orderTypeRef.current);
    };
    window.addEventListener('popstate', restorePageFromHistory);
    return () => window.removeEventListener('popstate', restorePageFromHistory);
  }, [enabled, fetchFamilies, categoryId]);

  return {
    families,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize: OFFER_FAMILY_PAGE_SIZE,
    onPageChange,
    refetch,
  };
}

function isFamily(value: CatalogOfferFamily | null): value is CatalogOfferFamily {
  return value !== null;
}
