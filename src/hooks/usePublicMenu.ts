'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { publicCategoryIdFromQuery, publicMenuQuery, publicRouteLocation } from '@/lib/publicRouteQuery';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY, type PublicMenuView } from './publicMenu/constants';
import { usePublicMenuCategories } from './publicMenu/usePublicMenuCategories';
import { usePublicMenuData } from './publicMenu/usePublicMenuData';
import type { PublicMenuClientData } from '@/types/publicDiscovery';

export { ALL_ITEMS_KEY, MENU_BUNDLES_KEY };
export type { PublicMenuView };

function initialMenuView(
  initialView: string,
  trackCategoryInUrl: boolean,
  initialSnapshot?: PublicMenuClientData,
): PublicMenuView {
  if (
    !trackCategoryInUrl ||
    typeof window === 'undefined' ||
    publicRouteLocation(window.location.pathname)?.surface !== 'menu'
  ) {
    return initialView;
  }
  const query = new URLSearchParams(window.location.search);
  if (query.get('view') === 'bundles' || query.has('bundlesPage')) return ALL_ITEMS_KEY;
  const categoryId = publicCategoryIdFromQuery(query);
  if (!categoryId) return ALL_ITEMS_KEY;
  const categoryKnown = initialSnapshot?.categories.some((category) => category.id === categoryId) ?? false;
  if (initialSnapshot?.categoriesComplete && !categoryKnown) return ALL_ITEMS_KEY;
  return categoryId;
}

export function usePublicMenu(
  enabled = true,
  initialSnapshot?: PublicMenuClientData,
  initialView: string = ALL_ITEMS_KEY,
  trackCategoryInUrl = false,
) {
  const categories = usePublicMenuCategories(initialSnapshot?.categories, initialSnapshot?.categoriesComplete);
  const {
    items,
    menuBundles,
    isLoading: isLoadingProducts,
    isLoadingBundles,
    error: productsError,
    bundlesError,
    currentPage,
    totalPages,
    totalCount,
    bundlesCurrentPage,
    bundlesTotalPages,
    bundlesTotalCount,
    pageSize,
    fetchProducts,
    fetchMenuBundles,
  } = usePublicMenuData(initialSnapshot);
  const [currentSelectedView, setCurrentSelectedView] = useState<PublicMenuView>(() =>
    initialMenuView(initialView, trackCategoryInUrl, initialSnapshot),
  );
  const firstProductRequest = useRef(true);
  const firstBundleRequest = useRef(true);
  const requestedProductPage = useRef(initialSnapshot?.products.currentPage ?? 1);
  const requestedBundlePage = useRef(initialSnapshot?.bundles.currentPage ?? 1);
  const selectedViewRef = useRef(currentSelectedView);
  const { state: orderTypeState, hydrated: orderTypeHydrated } = useOrderType();
  const orderType = orderTypeState.orderType;
  const orderTypeRef = useRef(orderType);

  useEffect(() => {
    selectedViewRef.current = currentSelectedView;
  }, [currentSelectedView]);

  useEffect(() => {
    orderTypeRef.current = orderType;
  }, [orderType]);

  const updateUrl = useCallback(
    (view: PublicMenuView, page: number) => {
      if (typeof window === 'undefined' || !window.location.pathname.endsWith('/menu')) return;
      const categoryId =
        trackCategoryInUrl && view !== ALL_ITEMS_KEY && view !== MENU_BUNDLES_KEY && view ? String(view) : null;
      const query = publicMenuQuery(
        new URLSearchParams(window.location.search),
        view === MENU_BUNDLES_KEY ? 'bundles' : 'products',
        page,
        categoryId,
      );
      const search = query.toString();
      const nextUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      window.history.pushState(null, '', nextUrl);
    },
    [trackCategoryInUrl],
  );

  const setSelectedView = useCallback(
    (view: string) => {
      requestedProductPage.current = 1;
      requestedBundlePage.current = 1;
      selectedViewRef.current = view;
      setCurrentSelectedView(view);
      updateUrl(view, 1);
    },
    [updateUrl],
  );

  useEffect(() => {
    if (!enabled || !orderTypeHydrated) return;
    const page = firstBundleRequest.current ? (initialSnapshot?.bundles.currentPage ?? 1) : requestedBundlePage.current;
    firstBundleRequest.current = false;
    void fetchMenuBundles(page, orderType);
  }, [enabled, orderType, orderTypeHydrated, fetchMenuBundles, initialSnapshot]);

  useEffect(() => {
    if (!enabled || currentSelectedView !== MENU_BUNDLES_KEY || !orderTypeHydrated) return;
    void fetchMenuBundles(requestedBundlePage.current, orderTypeRef.current);
  }, [enabled, currentSelectedView, orderTypeHydrated, fetchMenuBundles]);

  useEffect(() => {
    if (!enabled || !currentSelectedView || currentSelectedView === MENU_BUNDLES_KEY || !orderTypeHydrated) return;
    const page = firstProductRequest.current
      ? (initialSnapshot?.products.currentPage ?? 1)
      : requestedProductPage.current;
    firstProductRequest.current = false;
    void fetchProducts(page, currentSelectedView, orderType);
  }, [enabled, currentSelectedView, orderType, orderTypeHydrated, fetchProducts, initialSnapshot]);

  const handlePageChange = useCallback(
    (page: number) => {
      const isBundles = selectedViewRef.current === MENU_BUNDLES_KEY;
      const view = isBundles ? MENU_BUNDLES_KEY : selectedViewRef.current;
      if (isBundles) requestedBundlePage.current = page;
      else requestedProductPage.current = page;
      updateUrl(view, page);
      if (isBundles) void fetchMenuBundles(page, orderTypeRef.current);
      else void fetchProducts(page, view, orderTypeRef.current);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [fetchMenuBundles, fetchProducts, updateUrl],
  );

  useEffect(() => {
    const syncFromHistory = () => {
      const query = new URLSearchParams(window.location.search);
      const isBundles = query.get('view') === 'bundles' || query.has('bundlesPage');
      const categoryId = trackCategoryInUrl ? query.get('categoryId') : null;
      const nextView = isBundles ? MENU_BUNDLES_KEY : categoryId || ALL_ITEMS_KEY;
      const pageValue = Number(query.get(isBundles ? 'bundlesPage' : 'page'));
      const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
      if (isBundles) requestedBundlePage.current = page;
      else requestedProductPage.current = page;
      const changedView = selectedViewRef.current !== nextView;
      selectedViewRef.current = nextView;
      if (changedView) setCurrentSelectedView(nextView);
      else if (!enabled) return;
      else if (isBundles) void fetchMenuBundles(page, orderTypeRef.current);
      else void fetchProducts(page, nextView, orderTypeRef.current);
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, [enabled, fetchMenuBundles, fetchProducts, trackCategoryInUrl]);

  const refetch = useCallback(() => {
    if (selectedViewRef.current === MENU_BUNDLES_KEY) {
      return fetchMenuBundles(bundlesCurrentPage, orderTypeRef.current);
    }
    return fetchProducts(currentPage, selectedViewRef.current, orderTypeRef.current);
  }, [bundlesCurrentPage, currentPage, fetchMenuBundles, fetchProducts]);

  const isBundlesView = currentSelectedView === MENU_BUNDLES_KEY;
  return {
    categories,
    selectedView: currentSelectedView,
    setSelectedView,
    items,
    menuBundles,
    isLoading: isBundlesView ? isLoadingBundles : isLoadingProducts,
    error: isBundlesView ? bundlesError : productsError,
    currentPage: isBundlesView ? bundlesCurrentPage : currentPage,
    totalPages: isBundlesView ? bundlesTotalPages : totalPages,
    totalCount: isBundlesView ? bundlesTotalCount : totalCount,
    pageSize,
    onPageChange: handlePageChange,
    refetch,
  } as const;
}
