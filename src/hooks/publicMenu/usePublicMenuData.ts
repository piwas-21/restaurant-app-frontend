'use client';

import { useCallback, useRef, useState } from 'react';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';
import type { MenuBundleItem, MenuItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import { ALL_ITEMS_KEY } from './constants';
import { IDLE, errorMessage, type FetcherState } from './pipeline';
import { isVisible, mapBundleDtoToMenuBundleItem, mapProductDtoToMenuItem } from './mappers';
import type { MenuBundleListResponse, ProductListResponse } from './types';

/**
 * One page holds a whole category, so the client-side filters (`useMenuFilters`) filter the whole
 * category rather than page 1 of N. It was 10, which is what made a "Gluten-free" chip a lie: it
 * would hide matching dishes on pages 2–7 with nothing on screen to say so.
 *
 * 200 rather than "all": it is comfortably above any single category a restaurant menu has (RUMI's
 * whole catalogue is 71 across 9 categories) while still bounding what one request can pull. A
 * tenant who exceeds it keeps pagination and the filter row keeps printing its match count against
 * what it actually loaded, so the number on screen stays true either way.
 */
export const PAGE_SIZE = 200;

/**
 * The two fetchers are INDEPENDENT PIPELINES with disjoint state (a FetcherState each): they run
 * CONCURRENTLY since bundles load on every view (they are grouped into the category tabs), so a
 * shared slot would let one pipeline clobber the other — a slow bundles response re-writing the
 * count line, or a bundles failure blanking the products grid. `usePublicMenu` composes the
 * active view's halves for the page.
 */

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
export function usePublicMenuData(): UsePublicMenuDataReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuBundles, setMenuBundles] = useState<MenuBundleItem[]>([]);
  const [products, setProducts] = useState<FetcherState>(IDLE);
  const [bundles, setBundles] = useState<FetcherState>(IDLE);

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
      setItems([]);
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
        const response = (await getProducts(
          page,
          PAGE_SIZE,
          catId || undefined,
          undefined,
          requestedOrderType,
          true,
        )) as ProductListResponse;
        if (localId !== productsRequestIdRef.current) return; // stale — newer fetch in flight
        if (!response.success) {
          // Through the same helper as the thrown path: both feed one `setError`, so "blank is
          // absence" has to hold on both or the invariant is only half true. `||` alone let a
          // whitespace-only `message` through.
          reportError(errorMessage(response, 'Failed to fetch products'));
          return;
        }
        setProducts((state) => ({
          ...state,
          isLoading: false,
          totalPages: response.data?.totalPages || 1,
          totalCount: response.data?.totalCount || 0,
          currentPage: page,
        }));
        const mapped = (response.data?.items || []).map((p) => mapProductDtoToMenuItem(p, catId || undefined));
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
    setMenuBundles([]);
    // Every failure exit runs through here, so the loading flag clears where it was raised.
    const reportError = (msg: string) => {
      setBundles((state) => ({ ...state, error: msg, isLoading: false }));
      setMenuBundles([]);
    };
    try {
      const response = (await getPublicMenuBundles(page, PAGE_SIZE, requestedOrderType)) as MenuBundleListResponse;
      if (localId !== bundlesRequestIdRef.current) return;
      if (!response.success) {
        reportError(errorMessage(response, 'Failed to fetch menu bundles'));
        return;
      }
      setBundles((state) => ({
        ...state,
        isLoading: false,
        totalPages: response.data?.totalPages || 1,
        totalCount: response.data?.totalCount || 0,
        currentPage: page,
      }));
      const mapped = (response.data?.items || []).map(mapBundleDtoToMenuBundleItem);
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
