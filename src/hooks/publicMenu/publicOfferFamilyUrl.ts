import { publicMenuPageHref, publicRouteLocation } from '@/lib/publicRouteQuery';

/** Reads an offer page only when the current URL's category filter matches the active view. */
export function currentPublicOfferPage(categoryId: string | null): number | null {
  if (typeof window === 'undefined') return null;
  const route = publicRouteLocation(window.location.pathname);
  if (route?.surface !== 'menu') return null;
  const query = new URLSearchParams(window.location.search);
  if ((query.get('categoryId') || null) !== categoryId) return null;
  const rawPage = query.get('page');
  if (!rawPage || !/^\d+$/.test(rawPage)) return 1;
  const page = Number(rawPage);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Keeps category and QR context while an offer family pagination control changes pages. */
export function updatePublicOfferPageUrl(page: number, push: boolean): void {
  if (typeof window === 'undefined') return;
  const route = publicRouteLocation(window.location.pathname);
  if (route?.surface !== 'menu') return;
  const href = publicMenuPageHref(route.locale, window.location.search, 'products', page);
  if (push) window.history.pushState(window.history.state, '', href);
  else window.history.replaceState(window.history.state, '', href);
}
