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
      const path = `/menu${page > 1 ? `?page=${page}` : ''}`;
      entries.push({
        url: `${origin}/${locale}${path}`,
        alternates: { languages: localizedAlternates(origin, menu.indexableLocales, 'products', page) },
      });
    }
    for (let page = 1; page <= menu.bundlePageCount; page += 1) {
      const path = `/menu?view=bundles${page > 1 ? `&bundlesPage=${page}` : ''}`;
      entries.push({
        url: `${origin}/${locale}${path}`,
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
  const result = Object.fromEntries(
    locales.map((locale) => [
      locale,
      `${origin}/${locale}/menu${
        view === 'products'
          ? page > 1
            ? `?page=${page}`
            : ''
          : `?view=bundles${page > 1 ? `&bundlesPage=${page}` : ''}`
      }`,
    ]),
  );
  const fallback = result[TENANT_PUBLIC_CONFIG.defaultLocale];
  if (fallback) result['x-default'] = fallback;
  return result;
}
