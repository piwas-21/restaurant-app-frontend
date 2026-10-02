import { apiClient, ApiError } from '@/utils/apiClient';
import type {
  DeliveryChannelAvailability,
  DeliveryChannelAvailabilityAction,
  DeliveryChannelDisconnectResult,
  DeliveryChannelManagementSummary,
  DeliveryChannelOAuthFlow,
  DeliveryChannelOAuthStart,
} from '@/types/deliveryChannelManagement';
import type {
  DeliveryChannelCatalogue,
  DeliveryChannelCatalogueCandidates,
  DeliveryChannelCatalogueDraft,
  DeliveryChannelCatalogueDraftRequest,
  DeliveryChannelPublication,
  DeliveryChannelPreview,
  DeliveryChannelPreviewRequest,
  DeliveryChannelPublishRequest,
} from '@/types/deliveryChannelCatalogue';
import type {
  DeliveryChannelException,
  DeliveryChannelExceptionInbox,
  DeliveryChannelReconcileResult,
} from '@/types/deliveryChannelExceptions';

const BASE = '/api/delivery-channels/management/uber';
const AUTH = { requireAuth: true } as const;

export type DeliveryChannelMutationFailure = 'stale' | 'rejected' | 'uncertain';

/** A 409 is a confirmed stale write; 5xx, timeout and network failures may have committed. */
export function classifyDeliveryChannelMutationFailure(error: unknown): DeliveryChannelMutationFailure {
  if (!(error instanceof ApiError)) return 'uncertain';
  if (error.status === 409) return 'stale';
  if (error.status === 0 || error.status === 408 || error.status >= 500) return 'uncertain';
  return 'rejected';
}

export function isDeliveryChannelModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.errorCode === 'ModuleNotEnabled';
}

export function isSafeUberAuthorizationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const trustedHost =
      host === 'uber.com' || host.endsWith('.uber.com') || host === 'ubereats.com' || host.endsWith('.ubereats.com');
    return (
      url.protocol === 'https:' && trustedHost && !url.username && !url.password && (!url.port || url.port === '443')
    );
  } catch (error) {
    // Malformed provider input is rejected locally; the connect panel renders translated safety guidance.
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export const deliveryChannelManagementService = {
  getSummary: () => apiClient.get<DeliveryChannelManagementSummary>(BASE, AUTH),
  startOAuth: (enableOrderAcceptance: boolean) =>
    apiClient.post<DeliveryChannelOAuthStart>(`${BASE}/oauth/start`, { enableOrderAcceptance }, AUTH),
  getOAuthFlow: (flowId: string) =>
    apiClient.get<DeliveryChannelOAuthFlow>(`${BASE}/oauth/flows/${encodeURIComponent(flowId)}`, AUTH),
  getCatalogue: () => apiClient.get<DeliveryChannelCatalogue>(`${BASE}/catalogue`, AUTH),
  getCandidates: (search: string, cursor: string | null) => {
    const query = new URLSearchParams({ search });
    if (cursor) query.set('cursor', cursor);
    return apiClient.get<DeliveryChannelCatalogueCandidates>(`${BASE}/catalogue/candidates?${query.toString()}`, AUTH);
  },
  saveDraft: (request: DeliveryChannelCatalogueDraftRequest) =>
    apiClient.put<DeliveryChannelCatalogueDraft>(`${BASE}/catalogue/draft`, request, AUTH),
  preview: (request: DeliveryChannelPreviewRequest) =>
    apiClient.post<DeliveryChannelPreview>(`${BASE}/catalogue/preview`, request, AUTH),
  publish: (request: DeliveryChannelPublishRequest) =>
    apiClient.post<DeliveryChannelPublication>(`${BASE}/catalogue/publish`, request, AUTH),
  getPublication: (id: string) =>
    apiClient.get<DeliveryChannelPublication>(`${BASE}/catalogue/publications/${encodeURIComponent(id)}`, AUTH),
  getAvailability: () => apiClient.get<DeliveryChannelAvailability>(`${BASE}/availability`, AUTH),
  pauseAvailability: (durationMinutes: 15 | 30 | 60 | 240 | null) =>
    apiClient.post<DeliveryChannelAvailabilityAction>(`${BASE}/availability/pause`, { durationMinutes }, AUTH),
  resumeAvailability: () =>
    apiClient.post<DeliveryChannelAvailabilityAction>(`${BASE}/availability/resume`, undefined, AUTH),
  getExceptions: (cursor: string | null) => {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    const serialized = query.toString();
    const suffix = serialized ? `?${serialized}` : '';
    return apiClient.get<DeliveryChannelExceptionInbox>(`${BASE}/exceptions${suffix}`, AUTH);
  },
  getException: (id: string) =>
    apiClient.get<DeliveryChannelException>(`${BASE}/exceptions/${encodeURIComponent(id)}`, AUTH),
  reconcileException: (id: string) =>
    apiClient.post<DeliveryChannelReconcileResult>(
      `${BASE}/exceptions/${encodeURIComponent(id)}/reconcile`,
      undefined,
      AUTH,
    ),
  disconnect: (storeId: string) =>
    apiClient.post<DeliveryChannelDisconnectResult>(`${BASE}/disconnect`, { storeId }, AUTH),
};
