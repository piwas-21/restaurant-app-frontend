/**
 * Cashier Service
 *
 * Service layer for cashier-specific API calls and order management.
 * Handles all order operations: fetch, update status, payments, refunds, etc.
 */

import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import {
  OrderDto,
  OrderDtoPagedResultApiResponse,
  OrderDtoApiResponse,
  OrderPaymentDto,
  OrderPaymentDtoApiResponse,
  PagedResult,
  TableBillDto,
  TableBillApiResponse,
  PaymentOperationLookupApiResponse,
  PaymentOperationLookupDto,
} from '@/types/order';
import { SseDiagnostics } from '@/types/diagnostics';
import type { CashierOrdersFilters } from '@/types/cashier';

/**
 * The server context used by cashier date windows and order timestamps. Date ranges use the
 * date-only tenantStartDay/tenantEndDay fields below so the backend, not a browser clock, resolves
 * DST. Keeping the timezone beside the day prevents a device in a different zone from relabelling
 * a tenant order at the midnight boundary.
 */
export interface CashierTenantContext {
  readonly date?: string;
  readonly timeZone?: string;
}

export async function getCashierTenantContext(): Promise<CashierTenantContext | undefined> {
  const response = await apiClient.get<{ data?: { date?: unknown; timeZone?: unknown } }>('/api/tenant/today', {
    requireAuth: true,
  });
  const rawDate = response.data?.date;
  const rawTimeZone = response.data?.timeZone;
  const date = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  const timeZone = typeof rawTimeZone === 'string' && rawTimeZone.trim() ? rawTimeZone.trim() : undefined;

  return date || timeZone ? { date, timeZone } : undefined;
}

/** Backwards-compatible day-only facade for the legacy cashier date-range hook. */
export async function getCashierTenantDay(): Promise<string | undefined> {
  const context = await getCashierTenantContext();
  return context?.date;
}

/**
 * Get the server-owned cashier queue.
 *
 * Operational is the default cashier scope. It deliberately omits tenant-day and instant date
 * bounds: unfinished work must survive midnight, and the tenant clock belongs to the server. The
 * legacy All scope remains available to callers that explicitly need a date-windowed list.
 */
export async function getCashierOrders(filters?: CashierOrdersFilters): Promise<PagedResult<OrderDto>> {
  const params = new URLSearchParams();
  const scope = filters?.scope ?? 'Operational';

  params.append('scope', scope);
  appendCashierOrderFilters(params, filters, scope);

  const queryString = params.toString();
  const response = await apiClient.get<OrderDtoPagedResultApiResponse>(`/api/orders?${queryString}`, {
    requireAuth: true,
  });

  if (!response.data) {
    throw new Error('Failed to fetch orders');
  }

  return response.data;
}

function appendCashierOrderFilters(
  params: URLSearchParams,
  filters: CashierOrdersFilters | undefined,
  scope: string,
): void {
  if (!filters) return;

  const values: Record<string, string | number | undefined> = {
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    orderType: filters.orderType,
    search: filters.search,
    tableNumber: filters.tableNumber,
    page: filters.page,
    pageSize: filters.pageSize,
    modifiedSince: filters.modifiedSince?.toISOString(),
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.append(key, value.toString());
  });

  appendCashierDateFilters(params, filters, scope);
}

function appendCashierDateFilters(params: URLSearchParams, filters: CashierOrdersFilters, scope: string): void {
  // Operational has no date bounds by contract. Keep date parameters only for callers
  // that explicitly request the generic All scope; tenant day fields are date-only and backend-owned.
  if (scope === 'Operational') return;

  if (filters.tenantDay) params.append('tenantDay', filters.tenantDay);
  if (filters.tenantStartDay) params.append('tenantStartDay', filters.tenantStartDay);
  if (filters.tenantEndDay) params.append('tenantEndDay', filters.tenantEndDay);
  if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
  if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
}

/**
 * Get order by ID
 */
export async function getOrderById(orderId: string): Promise<OrderDto> {
  const response = await apiClient.get<OrderDtoApiResponse>(`/api/orders/${orderId}`, {
    requireAuth: true,
  });

  if (!response.data) {
    throw new Error('Failed to fetch order');
  }

  return response.data;
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<OrderDto> {
  const response = await apiClient.put<OrderDtoApiResponse>(
    `/api/orders/${orderId}/status`,
    { orderId, newStatus: status },
    { requireAuth: true },
  );

  if (!response.data) {
    throw new Error('Failed to update order status');
  }

  return response.data;
}

/**
 * Add payment to order
 */
export interface AddPaymentRequest {
  operationId: string;
  /** Server-issued order version observed when the cashier opened the tender. */
  expectedVersion?: number;
  paymentMethod: string;
  amount: number;
  transactionId?: string;
  referenceNumber?: string;
  cardLastFourDigits?: string;
  cardType?: string;
  // See `AddPaymentToOrderCommand` in src/types/order/commands.ts — the backend stopped binding
  // `paymentGateway` in S11, and nothing here ever sent it.
  paymentNotes?: string;
}

export async function addPaymentToOrder(orderId: string, paymentData: AddPaymentRequest): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `/api/orders/${orderId}/payments`,
    {
      orderId,
      ...paymentData,
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}

/**
 * Reconcile one uncertain staff payment write by its idempotency key.
 *
 * This endpoint is read-only and never accepts the original tender payload. An `Unknown` result is
 * a valid response, so this service only rejects when the transport or response envelope failed.
 */
export async function getPaymentOperation(orderId: string, operationId: string): Promise<PaymentOperationLookupDto> {
  const response = await apiClient.get<PaymentOperationLookupApiResponse>(
    `/api/orders/${encodeURIComponent(orderId)}/payments/operations/${encodeURIComponent(operationId)}`,
    { requireAuth: true },
  );

  if (!response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}

/** Readable alias for callers that describe the action as a lookup. */
export const lookupPaymentOperation = getPaymentOperation;

/**
 * Refund a payment
 */
export async function refundPayment(
  orderId: string,
  paymentId: string,
  refundAmount: number,
  refundReason: string,
): Promise<OrderPaymentDto> {
  const response = await apiClient.post<OrderPaymentDtoApiResponse>(
    `/api/orders/${orderId}/payments/${paymentId}/refund`,
    {
      orderId,
      paymentId,
      refundAmount,
      refundReason,
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throw new Error('Failed to refund payment');
  }

  return response.data;
}

/**
 * Cancel order
 */
export async function cancelOrder(orderId: string, reason?: string): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `/api/orders/${orderId}/cancel`,
    {
      orderId,
      cancellationReason: reason,
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throw new Error('Failed to cancel order');
  }

  return response.data;
}

/**
 * Toggle focus order status
 */
export async function toggleFocusOrder(
  orderId: string,
  isFocus: boolean,
  priority?: number,
  reason?: string,
): Promise<OrderDto> {
  const response = await apiClient.put<OrderDtoApiResponse>(
    `/api/orders/${orderId}/focus`,
    {
      orderId,
      isFocusOrder: isFocus,
      priority: priority || 1,
      focusReason: reason,
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throw new Error('Failed to toggle focus order');
  }

  return response.data;
}

/**
 * Send confirmation email
 */
export async function sendConfirmationEmail(orderId: string): Promise<void> {
  await apiClient.post(`/api/orders/${orderId}/send-confirmation-email`, {}, { requireAuth: false });
}

/**
 * Quick confirm order with preparation time (used in cashier quick-confirm modal)
 * Uses the proper order status update API endpoint
 */
export async function quickConfirmOrder(orderNumber: string, preparationMinutes: number): Promise<void> {
  // First, get the order by number to get its ID
  const ordersResponse = await apiClient.get<OrderDtoPagedResultApiResponse>(
    `/api/orders?search=${orderNumber}&pageSize=1`,
    {
      requireAuth: true,
    },
  );

  const order = ordersResponse.data?.items?.[0];
  if (!order) {
    throw new Error(`Order ${orderNumber} not found`);
  }

  // Match backend logic: preparation time > 10 minutes requires customer approval
  const delayThresholdMinutes = 10;
  const newStatus = preparationMinutes > delayThresholdMinutes ? 'PendingApproval' : 'Confirmed';
  const statusNote =
    preparationMinutes > delayThresholdMinutes
      ? `Pending customer approval for ${preparationMinutes} min preparation time`
      : `Confirmed via quick-action with ${preparationMinutes} min preparation time`;

  // Update the order status
  const response = await apiClient.put<OrderDtoApiResponse>(
    `/api/orders/${order.id}/status`,
    {
      orderId: order.id,
      newStatus: newStatus,
      estimatedPreparationMinutes: preparationMinutes,
      notes: statusNote,
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throw new Error('Failed to confirm order');
  }
}

/**
 * Quick cancel order (used in cashier quick-confirm modal)
 * Uses the proper order cancel API endpoint
 */
export async function quickCancelOrder(orderNumber: string): Promise<void> {
  // First, get the order by number to get its ID
  const ordersResponse = await apiClient.get<OrderDtoPagedResultApiResponse>(
    `/api/orders?search=${orderNumber}&pageSize=1`,
    {
      requireAuth: true,
    },
  );

  const order = ordersResponse.data?.items?.[0];
  if (!order) {
    throw new Error(`Order ${orderNumber} not found`);
  }

  // Cancel the order
  const response = await apiClient.post<OrderDtoApiResponse>(
    `/api/orders/${order.id}/cancel`,
    {
      orderId: order.id,
      cancellationReason: 'Cancelled by cashier via quick-action',
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throw new Error('Failed to cancel order');
  }
}

/**
 * Get SSE events diagnostics for debugging connection issues
 * Returns information about connected clients, recent events, and errors
 */
export async function getEventsDiagnostics(): Promise<SseDiagnostics> {
  const response = await apiClient.get<SseDiagnostics>('/api/events/diagnostics', {
    requireAuth: false, // Diagnostics endpoint is public for debugging
  });

  return response;
}

/**
 * ONE bill for a table: the union of the table's open orders (every ordering
 * round), grouped per order, with bill-level sums. Fails when the table has no
 * open orders.
 */
export async function getTableBill(tableNumber: number): Promise<TableBillDto> {
  const response = await apiClient.get<TableBillApiResponse>(`/api/orders/table/${tableNumber}/bill`, {
    requireAuth: true,
  });

  // throwServerRefusal, not a generic Error (#435): the controller answers 200 with Success=false,
  // and the refusal ("No open orders found for table N") is the message the cashier needs.
  if (!response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}

/**
 * Take ONE tender against the table's whole bill — the backend spreads it
 * across the table's open orders oldest-round-first. Overpayment is rejected
 * server-side. Returns the post-payment bill.
 */
export async function addTableBillPayment(tableNumber: number, paymentData: AddPaymentRequest): Promise<TableBillDto> {
  const response = await apiClient.post<TableBillApiResponse>(
    `/api/orders/table/${tableNumber}/bill/payments`,
    {
      tableNumber,
      ...paymentData,
    },
    { requireAuth: true },
  );

  if (!response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}
