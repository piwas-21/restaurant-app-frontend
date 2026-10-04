import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/order';
import {
  amendmentResolutionContextSchema,
  type AmendmentResolutionContext,
} from '@/schemas/amendmentResolutionContext.schema';

/** Server-owned currency, concurrency and eligible manual tenders for a fresh Admin review. */
export async function getAmendmentResolutionContext(
  orderId: string,
  amendmentId: string,
  expected?: { readonly currency: string; readonly creditMinor: number },
): Promise<AmendmentResolutionContext> {
  const response = await apiClient.get<ApiResponse<unknown>>(
    `/api/staff/orders/${encodeURIComponent(orderId)}/amendments/${encodeURIComponent(amendmentId)}/financial-resolution/context`,
    { requireAuth: true, signOutOn401: false },
  );
  if (response.success !== true) throw new Error('resolution-context-unavailable');
  const value = amendmentResolutionContextSchema.parse(response.data);
  if (
    value.orderId.toLowerCase() !== orderId.toLowerCase() ||
    value.amendmentId.toLowerCase() !== amendmentId.toLowerCase() ||
    (expected && (value.currency !== expected.currency.toUpperCase() || value.creditMinor !== expected.creditMinor))
  )
    throw new Error('resolution-context-mismatch');
  return value;
}
