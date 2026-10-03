import { apiClient } from '@/utils/apiClient';
import { reportTableGuestFailure } from '@/lib/tableGuestFailureDiagnostics';

interface TenantFeaturesResponse {
  success?: unknown;
  data?: { tableGuestVisitsV1?: unknown };
}

export interface PublicTableGuestFeatureResult {
  readonly available: boolean;
  readonly enabled: boolean;
}

/** Read the anonymous tenant rollout once for public guest pages. */
export async function getPublicTableGuestFeature(): Promise<PublicTableGuestFeatureResult> {
  try {
    const response = await apiClient.get<TenantFeaturesResponse>('/api/tenant/features', { signOutOn401: false });
    if (response.success !== true || typeof response.data !== 'object' || response.data === null) {
      return { available: false, enabled: false };
    }

    return {
      available: true,
      enabled: response.data.tableGuestVisitsV1 === true,
    };
  } catch (featureError) {
    reportTableGuestFailure('read public feature', featureError);
    return { available: false, enabled: false };
  }
}
