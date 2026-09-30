import type { ApiCategory } from '@/types/menu';
import type { CatalogOfferFamilyDto } from '@/types/menu/offerFamily';
import type { MenuBundleDto, ProductDto } from '@/hooks/publicMenu/types';
import { readPublicCollection, type PublicCollection } from './publicDiscoveryApi';

export const PRODUCT_PAGE_SIZE = 200;
export const CATEGORY_PAGE_SIZE = 100;
export const OFFER_PAGE_SIZE = 100;
const MAX_MENU_PAGES = 20;
const MAX_CATEGORY_PAGES = 5;
const CATEGORY_PRODUCT_CONCURRENCY = 12;

export interface CategoryProductCollection {
  complete: boolean;
  byCategory: Record<string, ProductDto[]>;
  union: ProductDto[];
}

export function getCategories(): Promise<PublicCollection<ApiCategory>> {
  return readPublicCollection(
    (page) => `/api/Categories?PageNumber=${page}&PageSize=${CATEGORY_PAGE_SIZE}&IsActive=true`,
    CATEGORY_PAGE_SIZE,
    MAX_CATEGORY_PAGES,
  );
}

export function getProducts(): Promise<PublicCollection<ProductDto>> {
  return readPublicCollection(
    (page) => `/api/Products?Page=${page}&PageSize=${PRODUCT_PAGE_SIZE}&GuestAllView=true`,
    PRODUCT_PAGE_SIZE,
    MAX_MENU_PAGES,
  );
}

export function getBundles(): Promise<PublicCollection<MenuBundleDto>> {
  return readPublicCollection(
    (page) => `/api/Menus?page=${page}&pageSize=${PRODUCT_PAGE_SIZE}`,
    PRODUCT_PAGE_SIZE,
    MAX_MENU_PAGES,
  );
}

export function getOfferFamilies(): Promise<PublicCollection<CatalogOfferFamilyDto>> {
  return readPublicCollection(
    (page) => `/api/Catalog?page=${page}&pageSize=${OFFER_PAGE_SIZE}`,
    OFFER_PAGE_SIZE,
    MAX_MENU_PAGES,
  );
}

export function visibleProducts(collection: PublicCollection<ProductDto>): ProductDto[] {
  return collection.items.filter(
    (product) => product.isActive !== false && product.isAvailable !== false && product.isComponent !== true,
  );
}

export function visibleBundles(collection: PublicCollection<MenuBundleDto>): MenuBundleDto[] {
  return collection.items.filter((bundle) => bundle.isActive !== false && bundle.isAvailable !== false);
}

export async function getProductsByCategory(categories: readonly ApiCategory[]): Promise<CategoryProductCollection> {
  const byCategory: Record<string, ProductDto[]> = Object.fromEntries(categories.map(({ id }) => [id, []]));
  const union = new Map<string, ProductDto>();
  let nextIndex = 0;
  let complete = true;
  const workers = Array.from({ length: Math.min(CATEGORY_PRODUCT_CONCURRENCY, categories.length) }, async () => {
    while (true) {
      const category = categories[nextIndex++];
      if (!category) return;
      const collection = await readPublicCollection<ProductDto>(
        (page) =>
          `/api/Products?Page=${page}&PageSize=${PRODUCT_PAGE_SIZE}&CategoryId=${encodeURIComponent(category.id)}&GuestAllView=true`,
        PRODUCT_PAGE_SIZE,
        MAX_MENU_PAGES,
      );
      if (!collection.complete) {
        complete = false;
        continue;
      }
      const visible = visibleProducts(collection);
      byCategory[category.id] = visible;
      for (const product of visible) union.set(product.id, product);
    }
  });
  await Promise.all(workers);
  return { complete, byCategory, union: [...union.values()] };
}

export function pageItems<T>(items: readonly T[], page: number, size: number): T[] {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

export function normalizedPage(requestedPage: number, totalPages: number): number {
  if (!Number.isInteger(requestedPage) || requestedPage < 1) return 1;
  return Math.min(requestedPage, Math.max(1, totalPages));
}
