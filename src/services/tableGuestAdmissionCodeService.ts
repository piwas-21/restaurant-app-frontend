import type { ApiResponse } from '@/types/order/common';
import type { TableGuestAdmissionCodeDto } from '@/types/tableGuestVisit';
import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';

export async function createTableGuestAdmissionCode(
  serviceSessionId: string,
  options: { readonly preferShortCode?: boolean } = {},
): Promise<TableGuestAdmissionCodeDto> {
  const sessionId = serviceSessionId.trim();
  if (!sessionId) throw new Error('A service session is required to create a guest code.');

  const query = options.preferShortCode ? '?preferShortCode=true' : '';
  const response = await apiClient.post<ApiResponse<TableGuestAdmissionCodeDto>>(
    `/api/table-guest-visits/${encodeURIComponent(sessionId)}/admission-code${query}`,
    {},
    { requireAuth: true },
  );
  if (response.success !== true || !response.data) throwServerRefusal(response);
  return response.data;
}
