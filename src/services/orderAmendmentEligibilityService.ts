import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/order';
import { orderAmendmentEligibilitySchema } from '@/schemas/orderAmendmentEligibility.schema';

export async function getOrderAmendmentEligibility(orderId: string) {
  const response = await apiClient.get<ApiResponse<unknown>>(
    `/api/staff/orders/${encodeURIComponent(orderId)}/amendments/eligibility`,
    { requireAuth: true, signOutOn401: false },
  );
  if (response.success !== true) throw new Error('amendment-eligibility-unavailable');
  const result = orderAmendmentEligibilitySchema.parse(response.data);
  if (result.orderId.toLowerCase() !== orderId.toLowerCase()) throw new Error('amendment-eligibility-mismatch');
  return result;
}
