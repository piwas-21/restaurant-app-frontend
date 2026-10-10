import { positiveIntegerConfig } from './configInteger';

/** Optional build-time branding freshness limits. */
const DEFAULT_TENANT_BRANDING_REFRESH_MS = 60_000;
const DEFAULT_TENANT_BRANDING_MAX_STALE_MS = 300_000;
const DEFAULT_TENANT_BRANDING_REQUEST_TIMEOUT_MS = 5_000;
export function resolveTenantBrandingConfig(input: {
  refreshMs?: string;
  maxStaleMs?: string;
  requestTimeoutMs?: string;
}) {
  const brandingRefreshMs = positiveIntegerConfig(input.refreshMs, DEFAULT_TENANT_BRANDING_REFRESH_MS);
  return {
    refreshMs: brandingRefreshMs,
    maxStaleMs: Math.max(
      brandingRefreshMs,
      positiveIntegerConfig(input.maxStaleMs, DEFAULT_TENANT_BRANDING_MAX_STALE_MS),
    ),
    requestTimeoutMs: positiveIntegerConfig(input.requestTimeoutMs, DEFAULT_TENANT_BRANDING_REQUEST_TIMEOUT_MS),
  };
}
