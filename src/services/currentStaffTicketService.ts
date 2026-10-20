import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { ApiResponse, OrderDto } from '@/types/order';

/** Authenticated, consistent group snapshot with committed item edits already applied by the server. */
export async function getCurrentStaffTicket(orderId: string): Promise<OrderDto[]> {
  const response = await apiClient.get<ApiResponse<OrderDto[]>>(
    `/api/orders/${encodeURIComponent(orderId)}/current-ticket`,
    { requireAuth: true },
  );
  if (!response.success) throwServerRefusal(response);
  if (!response.data?.length) throw new Error('Current ticket unavailable');
  return response.data;
}
