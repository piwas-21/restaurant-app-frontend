'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getProducts } from '@/services/menuService';
import { getPublicMenuBundles } from '@/services/menuBundleService';
import { isVisible, mapBundleDtoToMenuBundleItem, mapProductDtoToMenuItem } from './mappers';
import { IDLE, errorMessage, type FetcherState } from './pipeline';
import { PAGE_SIZE } from './usePublicMenuData';
import type { MenuBundleDto, ProductDto } from './types';
import type { ApiCategory, MenuItem, MenuBundleItem } from '@/types/menu';
import type { OrderType } from '@/types/order';
import type { PublicMenuClientData } from '@/types/publicDiscovery';
import { loadVisiblePages, type PublicPagedItems } from './loadVisiblePages';

/**
 * One category-section's slice of the one-page layout: all verified pages for that category,
 * with an independent loading/error slot so one failed category does not blank or stall others.
 */
export interface OnePageCategoryState {
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
}

export interface UseOnePageMenuDataReturn {
  /** Per-category product state, keyed by category id. Absent = not fetched yet. */
  byCategory: Record<string, OnePageCategoryState>;
  /** Every bundle, for the one bundles section + the customization sheet's lookup. */
  menuBundles: MenuBundleItem[];
  bundlesState: FetcherState;
  /** Reload one category's products (the section's Retry button). */
  refetchCategory: (categoryId: string) => void;
  /** Reload the bundles section. */
  refetchBundles: () => void;
}

/**
 * The one-page layout's data pipeline. Where `usePublicMenuData` owns ONE products
 * slice for the selected view, this fetches every category at once — N parallel
 * requests plus the bundles fetch, all carrying the guest's channel so each row's
 * order-type verdict resolves exactly as it does on a tab.
 *
 * Channel switches re-run the whole set: a card's availability is per-channel, and
 * the stale verdicts on the not-refetched sections would disagree with the fresh
 * ones mid-page. `enabled = false` stands the pipeline down (the tabs layout owns
 * the page).
 */
export function useOnePageMenuData(
  categories: ApiCategory[],
  enabled: boolean,
  initialSnapshot?: PublicMenuClientData,
): UseOnePageMenuDataReturn {
  const [byCategory, setByCategory] = useState<Record<string, OnePageCategoryState>>(() =>
    Object.fromEntries(
      Object.entries(initialSnapshot?.productsByCategory ?? {}).map(([categoryId, products]) => [
        categoryId,
        {
          items: products.map((product) => mapProductDtoToMenuItem(product, categoryId)).filter(isVisible),
          isLoading: false,
          error: null,
        },
      ]),
    ),
  );
  const [menuBundles, setMenuBundles] = useState<MenuBundleItem[]>(() =>
    (initialSnapshot?.bundles.items ?? []).map(mapBundleDtoToMenuBundleItem).filter(isVisible),
  );
  const [bundlesState, setBundlesState] = useState<FetcherState>(() => ({
    ...IDLE,
    currentPage: initialSnapshot?.bundles.currentPage ?? 1,
    totalPages: initialSnapshot?.bundles.totalPages ?? 1,
    totalCount: initialSnapshot?.bundles.totalCount ?? 0,
  }));
  const seededCategoryIds = useRef(new Set(Object.keys(initialSnapshot?.productsByCategory ?? {})));
  const preserveSeedBundles = useRef(initialSnapshot !== undefined);

  const { state: orderTypeState, hydrated: orderTypeHydrated } = useOrderType();
  const orderType = orderTypeState.orderType;

  // The channel at refetch time, read off the ref so the retry callbacks keep a
  // stable identity — the same hygiene `usePublicMenu`'s refetch applies.
  const orderTypeRef = useRef(orderType);
  useEffect(() => {
    orderTypeRef.current = orderType;
  }, [orderType]);

  // Request-id guards per pipeline slot — same stale-response rule as
  // usePublicMenuData, one counter per category plus one for bundles.
  const categoryRequestIds = useRef<Record<string, number>>({});
  const bundlesRequestId = useRef(0);

  const fetchCategoryProducts = useCallback(async (categoryId: string, requestedOrderType?: OrderType | null) => {
    const localId = (categoryRequestIds.current[categoryId] ?? 0) + 1;
    categoryRequestIds.current[categoryId] = localId;
    const preserveSeed = seededCategoryIds.current.delete(categoryId);
    setByCategory((state) => ({
      ...state,
      [categoryId]: { items: preserveSeed ? (state[categoryId]?.items ?? []) : [], isLoading: true, error: null },
    }));
    const reportError = (msg: string) =>
      setByCategory((state) => ({ ...state, [categoryId]: { items: [], isLoading: false, error: msg } }));
    try {
      // The same guest-surface opt-in as the tabs pipeline (`usePublicMenuData`): the guest's
      // menu must render even under a staff token, so the owner can preview hidden-from-All
      // categories exactly as a guest would see them.
      const loaded = await loadVisiblePages(
        (page) =>
          getProducts(page, PAGE_SIZE, categoryId, undefined, requestedOrderType, true) as Promise<
            PublicPagedItems<ProductDto>
          >,
        1,
        PAGE_SIZE,
      );
      if (localId !== categoryRequestIds.current[categoryId]) return;
      const mapped = loaded.allItems.map((p) => mapProductDtoToMenuItem(p, categoryId));
      setByCategory((state) => ({
        ...state,
        [categoryId]: { items: mapped.filter(isVisible), isLoading: false, error: null },
      }));
    } catch (e: unknown) {
      if (localId !== categoryRequestIds.current[categoryId]) return;
      console.error('Failed to fetch category products', e);
      reportError(errorMessage(e, 'Failed to fetch products'));
    }
  }, []);

  const fetchBundles = useCallback(async (requestedOrderType?: OrderType | null) => {
    const localId = ++bundlesRequestId.current;
    setBundlesState((state) => ({ ...state, isLoading: true, error: null }));
    if (!preserveSeedBundles.current) setMenuBundles([]);
    preserveSeedBundles.current = false;
    const reportError = (msg: string) => {
      setBundlesState((state) => ({ ...state, isLoading: false, error: msg }));
      setMenuBundles([]);
    };
    try {
      const loaded = await loadVisiblePages(
        (page) => getPublicMenuBundles(page, PAGE_SIZE, requestedOrderType) as Promise<PublicPagedItems<MenuBundleDto>>,
        1,
        PAGE_SIZE,
      );
      if (localId !== bundlesRequestId.current) return;
      setBundlesState((state) => ({
        ...state,
        isLoading: false,
        error: null,
        currentPage: 1,
        totalPages: loaded.totalPages,
        totalCount: loaded.totalCount,
      }));
      const mapped = loaded.allItems.map(mapBundleDtoToMenuBundleItem);
      setMenuBundles(mapped.filter(isVisible));
    } catch (e: unknown) {
      if (localId !== bundlesRequestId.current) return;
      console.error('Failed to fetch menu bundles', e);
      reportError(errorMessage(e, 'Failed to fetch menu bundles'));
    }
  }, []);

  // One load effect for the whole page: categories ride on the array identity the
  // categories hook publishes (initially [], then the loaded list, stable after), so
  // the fetches fire once the list lands and re-fire only when the channel changes.
  useEffect(() => {
    if (!enabled || !orderTypeHydrated || categories.length === 0) return;
    for (const category of categories) {
      void fetchCategoryProducts(category.id, orderType);
    }
    void fetchBundles(orderType);
  }, [enabled, orderTypeHydrated, orderType, categories, fetchCategoryProducts, fetchBundles]);

  const refetchCategory = useCallback(
    (categoryId: string) => {
      void fetchCategoryProducts(categoryId, orderTypeRef.current);
    },
    [fetchCategoryProducts],
  );

  const refetchBundles = useCallback(() => {
    void fetchBundles(orderTypeRef.current);
  }, [fetchBundles]);

  return { byCategory, menuBundles, bundlesState, refetchCategory, refetchBundles };
}
