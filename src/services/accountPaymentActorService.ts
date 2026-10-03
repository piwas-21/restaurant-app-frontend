import { apiClient } from '@/utils/apiClient';

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function canonicalAccountPaymentActorId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return undefined;
  const normalized = value.toLowerCase();
  return normalized === EMPTY_UUID ? undefined : normalized;
}

/** Resolve only the server-issued profile ID needed to scope staff payment recovery. */
export async function resolveAccountPaymentActorId(): Promise<string | undefined> {
  const response = await apiClient.get<unknown>('/api/User/profile', {
    requireAuth: true,
    signOutOn401: false,
  });
  if (!isRecord(response) || response.success !== true || !isRecord(response.data)) return undefined;
  return canonicalAccountPaymentActorId(response.data.id);
}
