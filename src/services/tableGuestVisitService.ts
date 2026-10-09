import { ApiError, apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { TableGuestAccountDto, TableGuestRoundRequest, TableGuestVisitIdentity } from '@/types/tableGuestVisit';

interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly errors?: string[];
  readonly errorCode?: string;
}

export async function joinTableGuestVisit(qrCodeData: string, admissionCode: string): Promise<TableGuestVisitIdentity> {
  const response = await apiClient.post<ApiResponse<TableGuestVisitIdentity>>('/api/table-guest-visits/join', {
    qrCodeData,
    admissionCode,
  });
  if (!response.success || !response.data) throwServerRefusal(response);
  return response.data;
}

export async function getTableGuestAccount(identity: TableGuestVisitIdentity): Promise<TableGuestAccountDto> {
  const response = await apiClient.get<ApiResponse<TableGuestAccountDto>>(
    `/api/table-guest-visits/${encodeURIComponent(identity.serviceSessionId)}/account`,
    { headers: { 'X-Table-Participant': identity.participantToken } },
  );
  if (!response.success || !response.data) throwServerRefusal(response);
  return response.data;
}

export async function createTableGuestRound(
  identity: TableGuestVisitIdentity,
  request: TableGuestRoundRequest,
): Promise<TableGuestAccountDto> {
  const response = await apiClient.post<ApiResponse<TableGuestAccountDto>>(
    `/api/table-guest-visits/${encodeURIComponent(identity.serviceSessionId)}/rounds`,
    request,
    {
      headers: { 'X-Table-Participant': identity.participantToken },
      requireSession: true,
    },
  );
  if (!response.success || !response.data) throwServerRefusal(response);
  return response.data;
}

export function isUnavailableVisitError(error: unknown): boolean {
  return error instanceof ApiError && [401, 403, 404, 410].includes(error.status);
}

export function isExpiredVisitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 410;
}

export const tableGuestVisitService = {
  joinTableGuestVisit,
  getTableGuestAccount,
  createTableGuestRound,
};
