'use client';

import { useCallback, useRef, useState } from 'react';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';
import type { MenuBundleItem, MenuItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { PublicMenuClientData } from '@/types/publicDiscovery';
import { ALL_ITEMS_KEY } from './constants';
import { IDLE, errorMessage, isFailureEnvelope, type FetcherState } from './pipeline';
import { isVisible, mapBundleDtoToMenuBundleItem, mapProductDtoToMenuItem } from './mappers';
import type { MenuBundleDto, ProductDto } from './types';
import { loadVisiblePages, type PublicPagedItems } from './loadVisiblePages';

/**
 * Each API request is bounded to 200 rows, then loadVisiblePages walks and validates the complete
 * collection before applying client-side filters. This keeps filter counts honest without
 * truncating a category or the catalogue when a tenant grows past one page.
 */
export const PAGE_SIZE = 200;

export interface UsePublicMenuDataReturn {
  items: MenuItem[];
  menuBundles: MenuBundleItem[];
  /** The PRODUCTS pipeline's flag — the main grid's skeleton on every product view. */
  isLoading: boolean;
  /** The BUNDLES pipeline's flag, for whichever surface renders bundles as its main list. */
  isLoadingBundles: boolean;
  /** The PRODUCTS pipeline's error slot — the main grid's error/Retry state. */
  error: string | null;
  /** The BUNDLES pipeline's error slot — the bundles view's error/Retry state. */
  bundlesError: string | null;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  /** The BUNDLES pipeline's pagination trio, kept beside the products one (see FetcherState). */
  bundlesCurrentPage: number;
  bundlesTotalPages: number;
  bundlesTotalCount: number;
  /** One PAGE_SIZE serves both pipelines. */
  pageSize: number;
  /**
   * `categoryId` is a category id, `null`, or the `ALL_ITEMS_KEY` sentinel. Typed as plain `string`
   * rather than `string | typeof ALL_ITEMS_KEY`: TypeScript widens the literal into `string` and the
   * union collapses, so the narrower arm documents nothing and only trips Sonar S6571.
   */
  fetchProducts: (page: number, categoryId: string | null, requestedOrderType?: OrderType | null) => Promise<void>;
  fetchMenuBundles: (page: number, requestedOrderType?: OrderType | null) => Promise<void>;
}

/**
 * Owns the paginated product + bundle state for the public menu.
 * Mapping is delegated to `./mappers` so this file stays focused on
 * loading orchestration (state + error handling + pagination metadata).
 */
export function usePublicMenuData(initialSnapshot?: PublicMenuClientData): UsePublicMenuDataReturn {
  const [items, setItems] = useState<MenuItem[]>(() =>
    (initialSnapshot?.products.items ?? []).map((product) => mapProductDtoToMenuItem(product)).filter(isVisible),
  );
  const [menuBundles, setMenuBundles] = useState<MenuBundleItem[]>(() =>
    (initialSnapshot?.bundles.items ?? []).map(mapBundleDtoToMenuBundleItem).filter(isVisible),
  );
  const [products, setProducts] = useState<FetcherState>(() => ({
    ...IDLE,
    currentPage: initialSnapshot?.products.currentPage ?? 1,
    totalPages: initialSnapshot?.products.totalPages ?? 1,
    totalCount: initialSnapshot?.products.totalCount ?? 0,
  }));
  const [bundles, setBundles] = useState<FetcherState>(() => ({
    ...IDLE,
    currentPage: initialSnapshot?.bundles.currentPage ?? 1,
    totalPages: initialSnapshot?.bundles.totalPages ?? 1,
    totalCount: initialSnapshot?.bundles.totalCount ?? 0,
  }));
  const preserveSeedProducts = useRef(initialSnapshot !== undefined);
  const preserveSeedBundles = useRef(initialSnapshot !== undefined);

  // Request-id guard per pipeline: rapid switching can race two in-flight fetches of the SAME
  // pipeline. Bump the counter on every start, capture the local id, and only commit state if it
  // is still the latest after the await; the loading flag stays owned by the latest request.
  const productsRequestIdRef = useRef(0);
  const bundlesRequestIdRef = useRef(0);

  // `requestedOrderType` is an ARGUMENT rather than a closure dependency on purpose: it keeps this
  // callback's identity stable, so adding the channel to the fetch cannot turn the caller's load
  // effect into one that re-runs on an unrelated identity change.
  const fetchProducts = useCallback(
    async (page: number, categoryId: string | null, requestedOrderType?: OrderType | null) => {
      const localId = ++productsRequestIdRef.current;
      setProducts((state) => ({ ...state, isLoading: true, error: null }));
      if (!preserveSeedProducts.current) setItems([]);
      preserveSeedProducts.current = false;
      // Every failure exit runs through here, so the loading flag clears where it was raised.
      const reportError = (msg: string) => {
        setProducts((state) => ({ ...state, error: msg, isLoading: false }));
        setItems([]);
      };
      try {
        const catId = categoryId === ALL_ITEMS_KEY ? null : categoryId;
        // The GUEST-SURFACE opt-in (menuService): /menu must render the guest's All list even when
        // the browser carries a staff token, or the owner cannot preview the hide-from-All flag
        // they just saved. The flag widens ONLY the hidden-category exclusion server-side.
        const loaded = await loadVisiblePages(
          async (requestedPage) => {
            const response = await getProducts(
              requestedPage,
              PAGE_SIZE,
              catId || undefined,
              undefined,
              requestedOrderType,
              true,
            );
            if (requestedPage === 1 && !response.success) {
              throw new Error(errorMessage(response, 'Failed to fetch products'));
            }
            return response as unknown as PublicPagedItems<ProductDto>;
          },
          page,
          PAGE_SIZE,
        );
        if (localId !== productsRequestIdRef.current) return; // stale — newer fetch in flight
        setProducts((state) => ({
          ...state,
          isLoading: false,
          totalPages: loaded.totalPages,
          totalCount: loaded.totalCount,
          currentPage: loaded.currentPage,
        }));
        const mapped = loaded.items.map((p) => mapProductDtoToMenuItem(p, catId || undefined));
        setItems(mapped.filter(isVisible));
      } catch (e: unknown) {
        if (localId !== productsRequestIdRef.current) return;
        console.error('Failed to fetch products', e);
        reportError(errorMessage(e, 'Failed to fetch products'));
      }
    },
    [],
  );

  // Channel as an ARGUMENT, for the same reason `fetchProducts` takes one: it keeps this callback's
  // identity stable, so resolving bundle availability cannot turn the caller's load effect into one
  // that re-runs on an unrelated identity change.
  const fetchMenuBundles = useCallback(async (page: number, requestedOrderType?: OrderType | null) => {
    const localId = ++bundlesRequestIdRef.current;
    setBundles((state) => ({ ...state, isLoading: true, error: null }));
    if (!preserveSeedBundles.current) setMenuBundles([]);
    preserveSeedBundles.current = false;
    // Every failure exit runs through here, so the loading flag clears where it was raised.
    const reportError = (msg: string) => {
      setBundles((state) => ({ ...state, error: msg, isLoading: false }));
      setMenuBundles([]);
    };
    try {
      const loaded = await loadVisiblePages(
        async (requestedPage) => {
          const response = await getPublicMenuBundles(requestedPage, PAGE_SIZE, requestedOrderType);
          if (requestedPage === 1 && isFailureEnvelope(response)) {
            throw new Error(errorMessage(response, 'Failed to fetch menu bundles'));
          }
          return response as unknown as PublicPagedItems<MenuBundleDto>;
        },
        page,
        PAGE_SIZE,
      );
      if (localId !== bundlesRequestIdRef.current) return;
      setBundles((state) => ({
        ...state,
        isLoading: false,
        totalPages: loaded.totalPages,
        totalCount: loaded.totalCount,
        currentPage: loaded.currentPage,
      }));
      const mapped = loaded.items.map(mapBundleDtoToMenuBundleItem);
      setMenuBundles(mapped.filter(isVisible));
    } catch (e: unknown) {
      if (localId !== bundlesRequestIdRef.current) return;
      console.error('Failed to fetch menu bundles', e);
      reportError(errorMessage(e, 'Failed to fetch menu bundles'));
    }
  }, []);

  return {
    items,
    menuBundles,
    isLoading: products.isLoading,
    isLoadingBundles: bundles.isLoading,
    error: products.error,
    bundlesError: bundles.error,
    currentPage: products.currentPage,
    totalPages: products.totalPages,
    totalCount: products.totalCount,
    bundlesCurrentPage: bundles.currentPage,
    bundlesTotalPages: bundles.totalPages,
    bundlesTotalCount: bundles.totalCount,
    pageSize: PAGE_SIZE,
    fetchProducts,
    fetchMenuBundles,
  };
}
