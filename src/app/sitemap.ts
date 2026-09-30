import type { MetadataRoute } from 'next';
import type { LanguageCode } from '@/config/languageConfig';
import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';
import { auditedHomeLocales } from '@/lib/publicHomeCoverage';
import { getPublicHomeData, getPublicMenuDiscovery } from '@/services/publicDiscoveryService';
import { publicIndexingAllowed } from '@/lib/publicRouteMetadata';

export const revalidate = 30;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = TENANT_PUBLIC_CONFIG.canonicalOrigin;
  if (!origin || !publicIndexingAllowed()) return [];
  const [homeData, menu] = await Promise.all([
    getPublicHomeData(TENANT_PUBLIC_CONFIG.defaultLocale),
    getPublicMenuDiscovery(TENANT_PUBLIC_CONFIG.defaultLocale, 1),
  ]);
  const homeLocales = homeData.restaurantInfo?.name?.trim() ? auditedHomeLocales(homeData) : [];
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of homeLocales) {
    entries.push({
      url: `${origin}/${locale}`,
      alternates: { languages: homeAlternates(origin, homeLocales) },
    });
  }
  if (!menu.coverageKnown || menu.indexableLocales.length === 0) return entries;

  for (const locale of menu.indexableLocales) {
    for (let page = 1; page <= menu.productPageCount; page += 1) {
      const path = localizedMenuPath('products', page);
      entries.push({
        url: localizedUrl(origin, locale, path),
        alternates: { languages: localizedAlternates(origin, menu.indexableLocales, 'products', page) },
      });
    }
    for (let page = 1; page <= menu.bundlePageCount; page += 1) {
      const path = localizedMenuPath('bundles', page);
      entries.push({
        url: localizedUrl(origin, locale, path),
        alternates: { languages: localizedAlternates(origin, menu.indexableLocales, 'bundles', page) },
      });
    }
  }
  return entries;
}

function homeAlternates(origin: string, locales: readonly LanguageCode[]): Record<string, string> {
  const result = Object.fromEntries(locales.map((locale) => [locale, `${origin}/${locale}`]));
  const fallback = result[TENANT_PUBLIC_CONFIG.defaultLocale];
  if (fallback) result['x-default'] = fallback;
  return result;
}

function localizedAlternates(
  origin: string,
  locales: readonly LanguageCode[],
  view: 'products' | 'bundles',
  page: number,
): Record<string, string> {
  const path = localizedMenuPath(view, page);
  const result = Object.fromEntries(locales.map((locale) => [locale, localizedUrl(origin, locale, path)]));
  const fallback = result[TENANT_PUBLIC_CONFIG.defaultLocale];
  if (fallback) result['x-default'] = fallback;
  return result;
}

function localizedMenuPath(view: 'products' | 'bundles', page: number): string {
  const query = new URLSearchParams();
  if (view === 'bundles') {
    query.set('view', 'bundles');
    if (page > 1) query.set('bundlesPage', String(page));
  } else if (page > 1) {
    query.set('page', String(page));
  }
  const search = query.toString();
  return search ? `/menu?${search}` : '/menu';
}

function localizedUrl(origin: string, locale: LanguageCode, path: string): string {
  return `${origin}/${locale}${path}`;
}
