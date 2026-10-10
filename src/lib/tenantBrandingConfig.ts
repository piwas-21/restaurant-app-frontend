import { positiveIntegerConfig } from './configInteger';

/** Optional build-time branding freshness limits. */
const DEFAULT_TENANT_BRANDING_REFRESH_MS = 60_000;
const DEFAULT_TENANT_BRANDING_MAX_STALE_MS = 300_000;
const DEFAULT_TENANT_BRANDING_REQUEST_TIMEOUT_MS = 5_000;
const brandingRefreshMs = positiveIntegerConfig(
  process.env.NEXT_PUBLIC_TENANT_BRANDING_REFRESH_MS,
  DEFAULT_TENANT_BRANDING_REFRESH_MS,
);
export const TENANT_BRANDING_CONFIG = {
  refreshMs: brandingRefreshMs,
  maxStaleMs: Math.max(
    brandingRefreshMs,
    positiveIntegerConfig(process.env.NEXT_PUBLIC_TENANT_BRANDING_MAX_STALE_MS, DEFAULT_TENANT_BRANDING_MAX_STALE_MS),
  ),
  requestTimeoutMs: positiveIntegerConfig(
    process.env.NEXT_PUBLIC_TENANT_BRANDING_REQUEST_TIMEOUT_MS,
    DEFAULT_TENANT_BRANDING_REQUEST_TIMEOUT_MS,
  ),
};
