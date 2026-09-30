import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { LanguageCode } from '@/config/languageConfig';
import { isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';
import { getPublicMenuDiscovery } from '@/services/publicDiscoveryService';
import { menuMetadata } from '@/lib/publicRouteMetadata';
import { publicMenuQuery, searchParamsToURLSearchParams, type PublicMenuView } from '@/lib/publicRouteQuery';
import MenuClientPage from '@/app/menu/MenuClientPage';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';

type RouteParams = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface MenuRouteData {
  locale: LanguageCode;
  view: PublicMenuView;
  discovery: Awaited<ReturnType<typeof getPublicMenuDiscovery>>;
  requestedPage: number;
  requestedBundlePage: number;
  selectedCategoryId: string | null;
  query: URLSearchParams;
}

async function menuData(params: RouteParams, searchParams: SearchParams): Promise<MenuRouteData> {
  const [{ locale }, queryRecord] = await Promise.all([params, searchParams]);
  if (!isSupportedPublicLocale(locale)) notFound();
  const query = searchParamsToURLSearchParams(queryRecord);
  const requestedPage = positivePage(query.get('page')) ?? 1;
  const requestedBundlePage = positivePage(query.get('bundlesPage')) ?? 1;
  const requestedView = query.get('view') === 'bundles' || query.has('bundlesPage') ? 'bundles' : 'products';
  const rawCategoryId = query.get('categoryId');
  const requestedCategoryId = requestedView === 'products' && validCategoryId(rawCategoryId) ? rawCategoryId : null;
  const discovery = await getPublicMenuDiscovery(locale, requestedPage, requestedBundlePage, requestedCategoryId);
  const categoryKnown =
    requestedCategoryId !== null &&
    discovery.clientData.categoriesComplete &&
    discovery.clientData.categories.some((category) => category.id === requestedCategoryId);
  const supportsCategoryFilter =
    discovery.categoryOffers && discovery.clientData.restaurantInfo?.menuLayout !== 'onepage';
  const selectedCategoryId =
    supportsCategoryFilter && requestedCategoryId && (!discovery.clientData.categoriesComplete || categoryKnown)
      ? requestedCategoryId
      : null;
  const view: PublicMenuView =
    !selectedCategoryId && !discovery.categoryOffers && requestedView === 'bundles' && discovery.bundlePageCount > 0
      ? 'bundles'
      : 'products';
  return { locale, view, discovery, requestedPage, requestedBundlePage, selectedCategoryId, query };
}

type LocalizedMenuProps = Readonly<{
  params: RouteParams;
  searchParams: SearchParams;
}>;

export async function generateMetadata({ params, searchParams }: LocalizedMenuProps): Promise<Metadata> {
  const { locale, view, discovery, selectedCategoryId } = await menuData(params, searchParams);
  const page = discovery.categoryOffers
    ? discovery.clientData.offerPage.currentPage
    : discovery.clientData.products.currentPage;
  const bundlePage = discovery.clientData.bundles.currentPage;
  return menuMetadata(
    locale,
    discovery.indexableLocales,
    view === 'bundles' ? 1 : page,
    discovery.clientData.restaurantInfo,
    bundlePage,
    view,
    selectedCategoryId,
  );
}

export default async function LocalizedMenu({ params, searchParams }: LocalizedMenuProps) {
  const { locale, view, discovery, requestedPage, requestedBundlePage, selectedCategoryId, query } = await menuData(
    params,
    searchParams,
  );
  const page = pageForView(view, discovery);
  const snapshotPage = view === 'bundles' ? discovery.clientData.bundles.currentPage : page;
  const requested = view === 'bundles' ? requestedBundlePage : requestedPage;
  const normalized = publicMenuQuery(query, view, page, selectedCategoryId);
  if (requested !== page || hasDifferentRouteQuery(query, normalized)) {
    const search = normalized.toString();
    const querySuffix = search ? `?${search}` : '';
    redirect(`/${locale}/menu${querySuffix}`);
  }

  return (
    <MenuClientPage
      key={`${locale}:${view}:${selectedCategoryId ?? 'all'}:${snapshotPage}`}
      initialSnapshot={discovery.clientData}
      initialView={view === 'bundles' ? MENU_BUNDLES_KEY : (selectedCategoryId ?? ALL_ITEMS_KEY)}
    />
  );
}

function pageForView(view: PublicMenuView, discovery: Awaited<ReturnType<typeof getPublicMenuDiscovery>>): number {
  if (view === 'bundles') return discovery.clientData.bundles.currentPage;
  if (discovery.categoryOffers) return discovery.clientData.offerPage.currentPage;
  return discovery.clientData.products.currentPage;
}

function positivePage(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validCategoryId(value: string | null): value is string {
  return value !== null && /^[\w-]{1,100}$/.test(value);
}

function hasDifferentRouteQuery(source: URLSearchParams, normalized: URLSearchParams): boolean {
  const routeKeys = new Set(['page', 'view', 'bundlesPage', 'categoryId']);
  const sourceEntries = [...source.entries()]
    .filter(([key]) => routeKeys.has(key))
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const normalizedEntries = [...normalized.entries()]
    .filter(([key]) => routeKeys.has(key))
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  return JSON.stringify(sourceEntries) !== JSON.stringify(normalizedEntries);
}
