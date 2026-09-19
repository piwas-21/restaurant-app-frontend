import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type {
  CreateStaffCounterOrderCommand,
  OrderDto,
  OrderDtoApiResponse,
  ReleaseStaffCounterOrderCommand,
  StaffCounterOrderRequest,
} from '@/types/order';

/**
 * The authenticated counter-sale contract (backend `StaffCounterOrdersController`).
 *
 * The quote is the server's own price: it builds the same order shape create persists, without
 * saving it, so the number the cashier reviews is authoritative before any money is asked for.
 * Create is idempotent by `clientOperationId`: a retry after an unknown outcome replays the
 * committed order instead of minting a second one, provided the payload is byte-identical.
 */
const BASE_PATH = '/api/staff/orders';

function requireData<T>(response: {
  data?: T;
  success?: boolean;
  message?: string;
  errors?: unknown;
  errorCode?: string;
}): T {
  // A failed envelope can still carry a falsy-looking but valid payload. Honor the envelope's
  // success bit before reading data so a refusal cannot masquerade as an empty answer.
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

/** Price the counter sale without persisting anything. Server output is the authoritative total. */
export async function quoteStaffCounterOrder(request: StaffCounterOrderRequest): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(`${BASE_PATH}/quote`, request, {
    requireAuth: true,
  });
  return requireData(response);
}

/**
 * Create the counter order exactly once for its `clientOperationId`. The payload sent here must
 * stay byte-identical across retries of the same intent — the server fingerprints it, and a
 * reused operation id with a different payload is refused rather than replayed.
 */
export async function createStaffCounterOrder(command: CreateStaffCounterOrderCommand): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(BASE_PATH, command, { requireAuth: true });
  return requireData(response);
}

/** Release a held order to the kitchen against its expected revision. */
export async function releaseStaffCounterOrder(
  orderId: string,
  command: ReleaseStaffCounterOrderCommand,
): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `${BASE_PATH}/${encodeURIComponent(orderId)}/release`,
    command,
    { requireAuth: true },
  );
  return requireData(response);
}
