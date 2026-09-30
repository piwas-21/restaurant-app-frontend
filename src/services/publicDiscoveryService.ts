import type { LanguageCode } from '@/config/languageConfig';
import type { LandingPageDto } from '@/types/landingPage';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';
import type { WorkingHoursDto } from '@/types/workingHours';
import type { ApiCategory } from '@/types/menu';
import type { ProductDto, MenuBundleDto } from '@/hooks/publicMenu/types';
import type { CatalogOfferFamily } from '@/types/menu/offerFamily';
import { auditMenuLocaleCoverage } from '@/lib/publicMenuCoverage';
import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';
import { configuredMenuCopyLocales } from '@/lib/publicHomeCoverage';
import type { PublicHomeData, PublicMenuClientData } from '@/types/publicDiscovery';
import { mapCatalogOfferFamilyDto } from '@/utils/offerFamily';
import { fetchPublicApiData, isRecord, type PublicCollection } from './publicDiscoveryApi';
import {
  getBundles,
  getCategories,
  getOfferFamilies,
  getProducts,
  getProductsByCategory,
  normalizedPage,
  OFFER_PAGE_SIZE,
  pageItems,
  PRODUCT_PAGE_SIZE,
  visibleBundles,
  visibleProducts,
  type CategoryProductCollection,
} from './publicDiscoveryCollections';

interface MenuSourceData {
  categories: PublicCollection<ApiCategory>;
  productsResult: PublicCollection<ProductDto>;
  bundlesResult: PublicCollection<MenuBundleDto>;
  info: RestaurantInfoDto | null;
  categoryProducts: CategoryProductCollection;
  categoryOffers: boolean;
  mappedFamilies: CatalogOfferFamily[];
  offerMappingKnown: boolean;
}

export interface PublicMenuDiscovery {
  clientData: PublicMenuClientData;
  coverageKnown: boolean;
  indexableLocales: LanguageCode[];
  productPageCount: number;
  bundlePageCount: number;
  categoryOffers: boolean;
}

function dataObject<T>(value: unknown): T | null {
  return isRecord(value) ? (value as T) : null;
}

async function restaurantInfo(): Promise<RestaurantInfoDto | null> {
  return dataObject<RestaurantInfoDto>(await fetchPublicApiData('/api/restaurant-info'));
}

export async function getPublicHomeData(locale: LanguageCode): Promise<PublicHomeData> {
  const [info, landing, hours] = await Promise.all([
    restaurantInfo(),
    fetchPublicApiData('/api/restaurant-info/landing'),
    fetchPublicApiData('/api/WorkingHours'),
  ]);
  return {
    locale,
    restaurantInfo: info,
    landingPage: dataObject<LandingPageDto>(landing),
    landingKnown: isRecord(landing),
    workingHours: Array.isArray(hours) ? (hours as WorkingHoursDto[]) : [],
  };
}

async function loadMenuSources(): Promise<MenuSourceData> {
  const [categories, productsResult, bundlesResult, info] = await Promise.all([
    getCategories(),
    getProducts(),
    getBundles(),
    restaurantInfo(),
  ]);
  const categoryProducts = categories.complete
    ? await getProductsByCategory(categories.items)
    : { complete: false, byCategory: {}, union: [] };
  const categoryOffers = info?.bundlePresentationMode === 'categoryOffers';
  const offers = categoryOffers ? await getOfferFamilies() : null;
  const offerRows = offers?.items ?? [];
  const mapped = offerRows.map(mapCatalogOfferFamilyDto);
  const mappedFamilies = mapped.filter((family): family is CatalogOfferFamily => family !== null);
  return {
    categories,
    productsResult,
    bundlesResult,
    info,
    categoryProducts,
    categoryOffers,
    mappedFamilies,
    offerMappingKnown: !categoryOffers || Boolean(offers?.complete && mappedFamilies.length === offerRows.length),
  };
}

function menuCoverage(source: MenuSourceData) {
  const categoriesKnown = source.categories.complete;
  const productsKnown = source.productsResult.complete;
  const bundlesKnown = source.bundlesResult.complete;
  const renderedProducts = new Map(visibleProducts(source.productsResult).map((product) => [product.id, product]));
  for (const product of source.categoryProducts.union) renderedProducts.set(product.id, product);
  const coverage = auditMenuLocaleCoverage(
    {
      categories: categoriesKnown ? source.categories.items : null,
      products: productsKnown && source.categoryProducts.complete ? [...renderedProducts.values()] : null,
      bundles: bundlesKnown ? visibleBundles(source.bundlesResult) : null,
      ...(source.categoryOffers ? { offerFamilies: source.offerMappingKnown ? source.mappedFamilies : null } : {}),
    },
    { candidates: TENANT_PUBLIC_CONFIG.menuLocales, defaultLocale: TENANT_PUBLIC_CONFIG.defaultLocale },
  );
  return {
    coverage,
    known:
      categoriesKnown && productsKnown && bundlesKnown && source.categoryProducts.complete && source.offerMappingKnown,
  };
}

function createClientSnapshot(
  locale: LanguageCode,
  source: MenuSourceData,
  requestedPage: number,
  requestedBundlesPage: number,
  selectedCategoryId: string | null,
): PublicMenuClientData {
  const products = visibleProducts(source.productsResult);
  const bundles = visibleBundles(source.bundlesResult);
  const fullOnePage = source.info?.menuLayout === 'onepage' && !source.categoryOffers;
  const productPageCount = fullOnePage ? 1 : Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE));
  const bundlePageCount = Math.max(1, Math.ceil(bundles.length / PRODUCT_PAGE_SIZE));
  const categoryFilter = source.info?.menuLayout === 'onepage' ? null : selectedCategoryId;
  const visibleOfferFamilies = categoryFilter
    ? source.mappedFamilies.filter((family) => family.categoryIds.includes(categoryFilter))
    : source.mappedFamilies;
  const offerPageCount = Math.max(1, Math.ceil(visibleOfferFamilies.length / OFFER_PAGE_SIZE));
  const currentPage = fullOnePage
    ? 1
    : source.categoryOffers
      ? normalizedPage(requestedPage, offerPageCount)
      : normalizedPage(requestedPage, productPageCount);
  return {
    locale,
    categories: source.categories.items,
    categoriesComplete: source.categories.complete,
    products: {
      currentPage,
      totalPages: source.categoryOffers ? offerPageCount : productPageCount,
      totalCount: source.categoryOffers ? visibleOfferFamilies.length : products.length,
      pageSize: source.categoryOffers ? OFFER_PAGE_SIZE : PRODUCT_PAGE_SIZE,
      items: pageItems(products, currentPage, PRODUCT_PAGE_SIZE),
    },
    bundles: {
      currentPage: source.categoryOffers ? 1 : normalizedPage(requestedBundlesPage, bundlePageCount),
      totalPages: bundlePageCount,
      totalCount: bundles.length,
      pageSize: PRODUCT_PAGE_SIZE,
      items: fullOnePage
        ? bundles
        : pageItems(bundles, normalizedPage(requestedBundlesPage, bundlePageCount), PRODUCT_PAGE_SIZE),
    },
    productsByCategory: source.categoryProducts.complete ? source.categoryProducts.byCategory : {},
    offerFamilies: pageItems(visibleOfferFamilies, currentPage, OFFER_PAGE_SIZE),
    offerPage: {
      currentPage,
      totalPages: offerPageCount,
      totalCount: visibleOfferFamilies.length,
      pageSize: OFFER_PAGE_SIZE,
    },
    restaurantInfo: source.info,
  };
}

export async function getPublicMenuDiscovery(
  locale: LanguageCode,
  requestedPage: number,
  requestedBundlesPage = 1,
  selectedCategoryId: string | null = null,
): Promise<PublicMenuDiscovery> {
  const source = await loadMenuSources();
  const { coverage, known } = menuCoverage(source);
  const clientData = createClientSnapshot(locale, source, requestedPage, requestedBundlesPage, selectedCategoryId);
  const copyLocales = configuredMenuCopyLocales();
  const indexableLocales =
    known && source.info?.name?.trim() ? coverage.locales.filter((candidate) => copyLocales.includes(candidate)) : [];
  const bundlePageCount =
    source.categoryOffers || source.info?.menuLayout === 'onepage' || visibleBundles(source.bundlesResult).length === 0
      ? 0
      : clientData.bundles.totalPages;
  return {
    clientData,
    coverageKnown: known,
    indexableLocales,
    productPageCount: clientData.products.totalPages,
    bundlePageCount,
    categoryOffers: source.categoryOffers,
  };
}
