/**
 * Server flow — order operations.
 * Split from `serverService.ts` (Sprint 2 frontend baseline ratchet).
 */

import { apiClient } from '@/utils/apiClient';
import {
  OrderDto,
  OrderDtoPagedResultApiResponse,
  OrderDtoApiResponse,
  PagedResult,
  CreateOrderItemDto,
  CreateOrderCommand,
  OrderType,
} from '@/types/order';
import { ApiResponse } from '@/types/reservation';

export async function getDineInOrders(filters?: {
  status?: string;
  tableNumber?: number;
  page?: number;
  pageSize?: number;
  modifiedSince?: Date;
}): Promise<PagedResult<OrderDto>> {
  const params = new URLSearchParams();
  params.append('type', 'DineIn');

  if (filters) {
    if (filters.status) params.append('status', filters.status);
    if (filters.tableNumber) params.append('tableNumber', filters.tableNumber.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
    if (filters.modifiedSince) params.append('modifiedSince', filters.modifiedSince.toISOString());
  }

  const response = await apiClient.get<OrderDtoPagedResultApiResponse>(`/api/orders?${params}`, {
    requireAuth: true,
  });

  if (!response.data) {
    throw new Error('Failed to fetch dine-in orders');
  }

  return response.data;
}

export async function updateOrderStatus(orderId: string, newStatus: string, notes?: string): Promise<OrderDto> {
  const response = await apiClient.put<OrderDtoApiResponse>(
    `/api/orders/${orderId}/status`,
    { orderId, newStatus, notes },
    { requireAuth: true },
  );

  if (!response.success) {
    throw new Error(response.message || 'Failed to update order status');
  }

  if (!response.data) {
    throw new Error('Failed to update order status - no data returned');
  }

  return response.data;
}

export async function markOrderCompleted(orderId: string): Promise<OrderDto> {
  return updateOrderStatus(orderId, 'Completed', 'All items served to table');
}

/**
 * Backend intelligently handles order transitions (active → completed,
 * pending/empty → cancelled) and returns counts per outcome.
 */
export async function completeAllTableOrders(tableNumber: string): Promise<{
  completedCount: number;
  cancelledCount: number;
  totalProcessed: number;
}> {
  const response = await apiClient.post<
    ApiResponse<{
      completedCount: number;
      cancelledCount: number;
      totalProcessed: number;
      processedOrderNumbers: string[];
    }>
  >(`/api/orders/table/${tableNumber}/complete-all`, {}, { requireAuth: true });

  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to complete table orders');
  }

  return {
    completedCount: response.data.completedCount,
    cancelledCount: response.data.cancelledCount,
    totalProcessed: response.data.totalProcessed,
  };
}

export async function getOrderById(orderId: string): Promise<OrderDto> {
  const response = await apiClient.get<OrderDtoApiResponse>(`/api/orders/${orderId}`, {
    requireAuth: true,
  });

  if (!response.data) {
    throw new Error('Failed to fetch order');
  }

  return response.data;
}

export async function getOrdersForTable(tableNumber: string): Promise<OrderDto[]> {
  const result = await getDineInOrders({
    tableNumber: parseInt(tableNumber, 10),
    status: 'Pending,Confirmed,Preparing,Ready',
    pageSize: 50,
  });
  return result.items || [];
}

export async function createServerOrder(
  tableNumber: number,
  items: CreateOrderItemDto[],
  customerName?: string,
  notes?: string,
  userId?: string,
  pointsToRedeem?: number,
): Promise<OrderDto> {
  const orderCommand: CreateOrderCommand = {
    type: OrderType.DineIn,
    tableNumber,
    items,
    customerName: customerName || `Table ${tableNumber}`,
    notes,
    userId: userId || undefined,
    pointsToRedeem: pointsToRedeem || undefined,
  };

  const response = await apiClient.post<OrderDtoApiResponse>('/api/Orders', orderCommand, { requireAuth: true });

  if (!response.data) {
    throw new Error('Failed to create order');
  }

  return response.data;
}
