// Server-side tenant-feature service. The /server layout reads this before rendering its client
// provider so a rollout flag never flashes a different workspace after hydration.
// `cache: no-store` is deliberate: this is an emergency rollback switch, not catalog data.
const SERVER_API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
const FEATURE_REQUEST_TIMEOUT_MS = Number(process.env.TENANT_FEATURES_REQUEST_TIMEOUT_MS);

export interface TenantFeatures {
  serverWorkspaceV2: boolean;
  tableAccountV1: boolean;
  orderAmendmentsV1: boolean;
}

interface TenantFeaturesResponse {
  success?: unknown;
  data?: { serverWorkspaceV2?: unknown; tableAccountV1?: unknown; orderAmendmentsV1?: unknown };
}

const DEFAULT_FEATURES: TenantFeatures = {
  serverWorkspaceV2: false,
  tableAccountV1: false,
  orderAmendmentsV1: false,
};

/**
 * Reads the backend's additive tenant rollout contract.
 *
 * This presentation switch fails CLOSED: absent configuration, an older backend (404), a
 * malformed response, or a network error all keep the established Server Workspace V1.
 */
export async function getTenantFeatures(): Promise<TenantFeatures> {
  if (!SERVER_API_BASE || !Number.isSafeInteger(FEATURE_REQUEST_TIMEOUT_MS) || FEATURE_REQUEST_TIMEOUT_MS <= 0) {
    return { ...DEFAULT_FEATURES };
  }

  try {
    const response = await fetch(`${SERVER_API_BASE}/api/tenant/features`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FEATURE_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ...DEFAULT_FEATURES };

    const body = (await response.json()) as TenantFeaturesResponse;
    if (body?.success !== true) return { ...DEFAULT_FEATURES };
    return {
      serverWorkspaceV2:
        typeof body.data?.serverWorkspaceV2 === 'boolean'
          ? body.data.serverWorkspaceV2
          : DEFAULT_FEATURES.serverWorkspaceV2,
      tableAccountV1:
        typeof body.data?.tableAccountV1 === 'boolean' ? body.data.tableAccountV1 : DEFAULT_FEATURES.tableAccountV1,
      orderAmendmentsV1:
        typeof body.data?.orderAmendmentsV1 === 'boolean'
          ? body.data.orderAmendmentsV1
          : DEFAULT_FEATURES.orderAmendmentsV1,
    };
  } catch (error) {
    console.warn('Could not read tenant rollout features; retaining Server Workspace V1', error);
    return { ...DEFAULT_FEATURES };
  }
}
