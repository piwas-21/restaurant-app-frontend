import type { MetadataRoute } from 'next';
import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';
import { publicIndexingAllowed } from '@/lib/publicRouteMetadata';

const PRIVATE_PATHS = [
  '/admin/',
  '/server/',
  '/cashier/',
  '/kitchen-staff/',
  '/auth/',
  '/account/',
  '/cart/',
  '/checkout/',
  '/orders/',
  '/my-orders/',
  '/my-reservations/',
  '/dev-portal/',
  '/api/',
];

export default function robots(): MetadataRoute.Robots {
  const origin = TENANT_PUBLIC_CONFIG.canonicalOrigin;
  if (!publicIndexingAllowed()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
    host: origin ?? undefined,
  };
}
