// Server-side tenant-feature service. The /server layout reads this before rendering its client
// provider so a rollout flag never flashes a different workspace after hydration.
// `cache: no-store` is deliberate: this is an emergency rollback switch, not catalog data.
const SERVER_API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
const FEATURE_REQUEST_TIMEOUT_MS = 3_000;

export interface TenantFeatures {
  serverWorkspaceV2: boolean;
}

interface TenantFeaturesResponse {
  success?: unknown;
  data?: { serverWorkspaceV2?: unknown };
}

const DEFAULT_FEATURES: TenantFeatures = { serverWorkspaceV2: false };

/**
 * Reads the backend's additive tenant rollout contract.
 *
 * This presentation switch fails CLOSED: absent configuration, an older backend (404), a
 * malformed response, or a network error all keep the established Server Workspace V1.
 */
export async function getTenantFeatures(): Promise<TenantFeatures> {
  if (!SERVER_API_BASE) return { ...DEFAULT_FEATURES };

  try {
    const response = await fetch(`${SERVER_API_BASE}/api/tenant/features`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FEATURE_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ...DEFAULT_FEATURES };

    const body = (await response.json()) as TenantFeaturesResponse;
    if (body?.success !== true) return { ...DEFAULT_FEATURES };
    const enabled = body?.data?.serverWorkspaceV2;
    return typeof enabled === 'boolean' ? { serverWorkspaceV2: enabled } : { ...DEFAULT_FEATURES };
  } catch (_error) {
    // IGNORED ON PURPOSE: rollout discovery is a presentation-only, fail-closed seam. A
    // timeout, older backend, or malformed response must retain the established V1 workspace;
    // there is no user-facing error surface before this server layout renders.
    return { ...DEFAULT_FEATURES };
  }
}
