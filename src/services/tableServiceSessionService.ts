import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type {
  AddTableServiceSessionPaymentRequest,
  CloseTableServiceSessionRequest,
  OpenTableServiceSessionRequest,
  TableServiceSessionApiResponse,
  TableServiceSessionDto,
  TableServiceSessionListApiResponse,
  TableServiceSessionPaymentOperationLookupApiResponse,
  TableServiceSessionPaymentOperationLookupDto,
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
export function openTableServiceSession(tableNumber: number, currency?: string): Promise<TableServiceSessionDto>;
export function openTableServiceSession(request: OpenTableServiceSessionRequest): Promise<TableServiceSessionDto>;
export async function openTableServiceSession(
  input: number | OpenTableServiceSessionRequest,
  currency?: string,
): Promise<TableServiceSessionDto> {
  const payload =
    typeof input === 'number'
      ? { tableNumber: input, ...(currency ? { currency } : {}) }
      : {
          ...(input.tableId ? { tableId: input.tableId } : {}),
          ...(input.tableNumber !== undefined ? { tableNumber: input.tableNumber } : {}),
          ...(input.currency ? { currency: input.currency } : {}),
        };
  const response = await apiClient.post<TableServiceSessionApiResponse>(BASE_PATH, payload, { requireAuth: true });
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

/** Look up a table payment outcome without replaying its write payload. */
export async function lookupTableServiceSessionPaymentOperation(
  serviceSessionId: string,
  operationId: string,
): Promise<TableServiceSessionPaymentOperationLookupDto> {
  const response = await apiClient.get<TableServiceSessionPaymentOperationLookupApiResponse>(
    `${BASE_PATH}/${encodeURIComponent(serviceSessionId)}/payments/operations/${encodeURIComponent(operationId)}`,
    { requireAuth: true },
  );
  return requireData(response);
}
