import { isSupportedPublicLocale } from './publicDiscoveryConfig';

export type PublicRouteSurface = 'home' | 'menu';

export interface PublicRouteLocation {
  locale: string;
  surface: PublicRouteSurface;
}

const CONTEXT_KEYS = ['qr', 'tableId', 'tableNumber', 'table', 'serviceSessionId', 'pwa'] as const;
const CATEGORY_ID_PATTERN = /^[\w-]{1,100}$/;

export type PublicMenuView = 'products' | 'bundles';

export function searchParamsToURLSearchParams(values: Record<string, string | string[] | undefined>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const entry of value) query.append(key, entry);
    } else if (typeof value === 'string') {
      query.append(key, value);
    }
  }
  return query;
}

/** Recognize only the locale-prefixed home and menu surfaces that are public discovery routes. */
export function publicRouteLocation(pathname: string | null): PublicRouteLocation | null {
  const segments = pathname?.split('/').filter(Boolean) ?? [];
  if (!segments[0] || !isSupportedPublicLocale(segments[0])) return null;
  if (segments.length === 1) return { locale: segments[0], surface: 'home' };
  if (segments.length === 2 && segments[1] === 'menu') return { locale: segments[0], surface: 'menu' };
  return null;
}

/** Keep tenant public navigation inside the active locale and preserve safe QR/table context. */
export function publicHomeHref(pathname: string | null, current: URLSearchParams | { toString(): string }): string {
  const route = publicRouteLocation(pathname);
  return route ? publicLocaleHref(route.locale, 'home', current) : '/';
}

export function isHomeRoutePathname(pathname: string | null): boolean {
  return pathname === '/' || publicRouteLocation(pathname)?.surface === 'home';
}

/** Preserve only known QR/table/PWA context and supported menu pagination on locale changes. */
export function publicLocaleHref(
  locale: string,
  surface: PublicRouteSurface,
  current: URLSearchParams | { toString(): string },
): string {
  const source = new URLSearchParams(current.toString());
  const query = publicContextQuery(source);
  if (surface === 'menu') copyMenuLocation(source, query);

  const path = `/${locale}${surface === 'menu' ? '/menu' : ''}`;
  return query.size ? `${path}?${query.toString()}` : path;
}

/** Only QR/table/PWA context travels between public routes. */
export function publicContextQuery(current: URLSearchParams | { toString(): string }): URLSearchParams {
  const source = new URLSearchParams(current.toString());
  const query = new URLSearchParams();
  for (const key of CONTEXT_KEYS) copyFirst(source, query, key);
  return query;
}

/** Normalized menu query for SSR redirects, pagination links and safe language changes. */
export function publicMenuQuery(
  current: URLSearchParams | { toString(): string },
  view: PublicMenuView,
  page: number,
  categoryId?: string | null,
): URLSearchParams {
  const source = new URLSearchParams(current.toString());
  const query = publicContextQuery(source);
  const selectedCategoryId = categoryId === undefined ? source.get('categoryId') : categoryId;
  if (view === 'bundles') {
    query.set('view', 'bundles');
    if (page > 1) query.set('bundlesPage', String(page));
  } else {
    if (page > 1) query.set('page', String(page));
    if (selectedCategoryId && CATEGORY_ID_PATTERN.test(selectedCategoryId)) query.set('categoryId', selectedCategoryId);
  }
  return query;
}

export function publicMenuPageHref(
  locale: string,
  current: URLSearchParams | { toString(): string },
  view: PublicMenuView,
  page: number,
): string {
  const query = publicMenuQuery(current, view, page);
  const search = query.toString();
  return `/${locale}/menu${search ? `?${search}` : ''}`;
}

function copyMenuLocation(source: URLSearchParams, query: URLSearchParams): void {
  const view = source.get('view');
  const bundlePage = positivePage(source.get('bundlesPage'));
  if (view === 'bundles' || bundlePage !== null) {
    query.set('view', 'bundles');
    if (bundlePage && bundlePage > 1) query.set('bundlesPage', String(bundlePage));
  } else {
    const page = positivePage(source.get('page'));
    if (page && page > 1) query.set('page', String(page));
    const categoryId = source.get('categoryId');
    if (categoryId && CATEGORY_ID_PATTERN.test(categoryId)) query.set('categoryId', categoryId);
  }
}

function copyFirst(source: URLSearchParams, destination: URLSearchParams, key: string): void {
  const value = source.get(key);
  if (value?.trim()) destination.set(key, value);
}

function positivePage(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}
