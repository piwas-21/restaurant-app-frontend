import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type {
  AddTableServiceSessionPaymentRequest,
  CloseTableServiceSessionRequest,
  TableServiceSessionApiResponse,
  TableServiceSessionDto,
  TableServiceSessionListApiResponse,
} from '@/types/order';

const BASE_PATH = '/api/table-service-sessions';

function requireData<T>(response: {
  data?: T;
  success?: boolean;
  message?: string;
  errors?: unknown;
  errorCode?: string;
}): T {
  // A failed envelope can still carry a falsy-looking but valid payload (for example,
  // an empty array). Honor the envelope's success bit before reading data so a refusal
  // cannot masquerade as an empty table/session list.
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

/** Read all open visits. The server assembles each visit's complete bill in this response. */
export async function getActiveTableServiceSessions(): Promise<TableServiceSessionDto[]> {
  const response = await apiClient.get<TableServiceSessionListApiResponse>(BASE_PATH, { requireAuth: true });
  return requireData(response);
}

/** Open one explicit table visit; the server owns currency and duplicate-session checks. */
export async function openTableServiceSession(tableNumber: number, currency?: string): Promise<TableServiceSessionDto> {
  const response = await apiClient.post<TableServiceSessionApiResponse>(
    BASE_PATH,
    { tableNumber, ...(currency ? { currency } : {}) },
    { requireAuth: true },
  );
  return requireData(response);
}

/** Read one visit independently of the active-table list. */
export async function getTableServiceSession(serviceSessionId: string): Promise<TableServiceSessionDto> {
  const response = await apiClient.get<TableServiceSessionApiResponse>(
    `${BASE_PATH}/${encodeURIComponent(serviceSessionId)}`,
    { requireAuth: true },
  );
  return requireData(response);
}

/** Submit one idempotent tender against a pinned session version. */
export async function addTableServiceSessionPayment(
  serviceSessionId: string,
  payment: AddTableServiceSessionPaymentRequest,
): Promise<TableServiceSessionDto> {
  const response = await apiClient.post<TableServiceSessionApiResponse>(
    `${BASE_PATH}/${encodeURIComponent(serviceSessionId)}/payments`,
    payment,
    { requireAuth: true },
  );
  return requireData(response);
}

/** Close a visit only after the server validates its current bill and version. */
export async function closeTableServiceSession(
  serviceSessionId: string,
  request: CloseTableServiceSessionRequest,
): Promise<TableServiceSessionDto> {
  const response = await apiClient.post<TableServiceSessionApiResponse>(
    `${BASE_PATH}/${encodeURIComponent(serviceSessionId)}/close`,
    request,
    { requireAuth: true },
  );
  return requireData(response);
}
