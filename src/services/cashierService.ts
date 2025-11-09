/**
 * Cashier Service
 *
 * Service layer for cashier-specific API calls and order management.
 * Handles all order operations: fetch, update status, payments, refunds, etc.
 */

import { apiClient } from '@/utils/apiClient';
import {
  OrderDto,
  OrderDtoPagedResultApiResponse,
  OrderDtoApiResponse,
  PagedResult,
} from '@/types/order';

/**
 * Get all orders with optional filters for cashier view
 */
export async function getCashierOrders(filters?: {
  status?: string;
  paymentStatus?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<OrderDto>> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.status) params.append('status', filters.status);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.type) params.append('type', filters.type);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
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
export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<OrderDto> {
  const response = await apiClient.put<OrderDtoApiResponse>(
    `/api/orders/${orderId}/status`,
    { orderId, status },
    { requireAuth: true }
  );

  if (!response.data) {
    throw new Error('Failed to update order status');
  }

  return response.data;
}

/**
 * Add payment to order
 */
export async function addPaymentToOrder(
  orderId: string,
  paymentData: {
    paymentMethod: string;
    amount: number;
    transactionId?: string;
    referenceNumber?: string;
    cardLastFourDigits?: string;
    cardType?: string;
    paymentGateway?: string;
    paymentNotes?: string;
  }
): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `/api/orders/${orderId}/payments`,
    {
      orderId,
      ...paymentData,
    },
    { requireAuth: true }
  );

  if (!response.data) {
    throw new Error('Failed to add payment');
  }

  return response.data;
}

/**
 * Refund a payment
 */
export async function refundPayment(
  orderId: string,
  paymentId: string,
  refundAmount?: number
): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `/api/orders/${orderId}/payments/${paymentId}/refund`,
    {
      orderId,
      paymentId,
      refundAmount,
    },
    { requireAuth: true }
  );

  if (!response.data) {
    throw new Error('Failed to refund payment');
  }

  return response.data;
}

/**
 * Cancel order
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<OrderDto> {
  const response = await apiClient.post<OrderDtoApiResponse>(
    `/api/orders/${orderId}/cancel`,
    {
      orderId,
      cancellationReason: reason,
    },
    { requireAuth: true }
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
  reason?: string
): Promise<OrderDto> {
  const response = await apiClient.put<OrderDtoApiResponse>(
    `/api/orders/${orderId}/focus`,
    {
      orderId,
      isFocusOrder: isFocus,
      priority: priority || 1,
      focusReason: reason,
    },
    { requireAuth: true }
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
  await apiClient.post(
    `/api/orders/${orderId}/send-confirmation-email`,
    {},
    { requireAuth: false }
  );
}
