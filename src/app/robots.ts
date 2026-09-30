import type { MetadataRoute } from 'next';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';
import { publicIndexingAllowed } from '@/lib/publicRouteMetadata';

const PRIVATE_ROUTE_ROOTS = [
  '/admin',
  '/server',
  '/cashier',
  '/kitchen-staff',
  '/auth',
  '/account',
  '/cart',
  '/checkout',
  '/orders',
  '/my-orders',
  '/my-reservations',
  '/dev-portal',
  '/scan',
  '/delete-account',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

export function privateCrawlerPaths(locales: readonly string[] = LANGUAGE_CODES): string[] {
  const localized = locales.flatMap((locale) =>
    PRIVATE_ROUTE_ROOTS.flatMap((route) => [`/${locale}${route}$`, `/${locale}${route}/`]),
  );
  return [...localized, '/api/'];
}

export default function robots(): MetadataRoute.Robots {
  const origin = TENANT_PUBLIC_CONFIG.canonicalOrigin;
  if (!publicIndexingAllowed()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: privateCrawlerPaths() },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
    host: origin ?? undefined,
  };
}
