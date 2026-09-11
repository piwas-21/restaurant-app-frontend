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
} from '@/types/order';
import { SseDiagnostics } from '@/types/diagnostics';

/**
 * Names the restaurant calendar day for the queue window. This stays in the cashier service so
 * the POS does not need the reservation-specific tenant-day cache/analytics bundle at first
 * paint. Undefined is deliberately safe: the caller omits its date filter rather than guessing
 * from a counter tablet's clock (#545).
 */
export async function getCashierTenantDay(): Promise<string | undefined> {
  const response = await apiClient.get<{ data?: { date?: unknown } }>('/api/tenant/today', {
    requireAuth: true,
  });
  const day = response.data?.date;

  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

/**
 * Get all orders with optional filters for cashier view
 */
export async function getCashierOrders(filters?: {
  status?: string;
  paymentStatus?: string;
  orderType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  /** The venue's calendar day — the server computes the window on the tenant clock (#545). */
  tenantDay?: string;
  startDate?: Date;
  endDate?: Date;
  modifiedSince?: Date; // For efficient polling - returns orders modified after this timestamp
}): Promise<PagedResult<OrderDto>> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.status) params.append('status', filters.status);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.orderType) params.append('orderType', filters.orderType);
    if (filters.search) params.append('search', filters.search);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.tenantDay) params.append('tenantDay', filters.tenantDay);
    if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());
    if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters.modifiedSince) params.append('modifiedSince', filters.modifiedSince.toISOString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/api/orders?${queryString}` : '/api/orders';

  const response = await apiClient.get<OrderDtoPagedResultApiResponse>(endpoint, {
    requireAuth: true,
  });

  if (!response.data) {
    throw new Error('Failed to fetch orders');
  }

  return response.data;
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
 * Refund a payment
 */
export async function refundPayment(
  orderId: string,
  paymentId: string,
  refundAmount?: number,
): Promise<OrderPaymentDto> {
  const response = await apiClient.post<OrderPaymentDtoApiResponse>(
    `/api/orders/${orderId}/payments/${paymentId}/refund`,
    {
      orderId,
      paymentId,
      refundAmount,
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
