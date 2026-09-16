/**
 * Server flow — order operations.
 * Split from `serverService.ts` (Sprint 2 frontend baseline ratchet).
 */

import { SERVER_ORDER_MAX_PAGES, SERVER_ORDER_PAGE_SIZE } from '@/lib/config';
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

export const ACTIVE_ORDER_STATUS_FILTER = 'Pending,Confirmed,Preparing,Ready';

const ACTIVE_ORDER_STATUSES = new Set(ACTIVE_ORDER_STATUS_FILTER.split(','));

type DineInOrderFilters = {
  status?: string;
  tableNumber?: number;
  page?: number;
  pageSize?: number;
  modifiedSince?: Date;
};

async function getDineInOrdersPage(filters?: DineInOrderFilters): Promise<PagedResult<OrderDto>> {
  const params = new URLSearchParams();
  params.append('type', 'DineIn');

  if (filters) {
    if (filters.status) params.append('status', filters.status);
    if (filters.tableNumber !== undefined) params.append('tableNumber', filters.tableNumber.toString());
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

function pageHasMore(result: PagedResult<OrderDto>, currentPage: number): boolean {
  return result.hasNextPage === true || result.totalPages > currentPage;
}

function isActiveStatusFilter(status?: string): boolean {
  return status?.split(',').some((value) => ACTIVE_ORDER_STATUSES.has(value.trim())) === true;
}

function shouldWalkAllPages(filters?: DineInOrderFilters): boolean {
  return (
    filters?.tableNumber !== undefined || filters?.modifiedSince !== undefined || isActiveStatusFilter(filters?.status)
  );
}

export async function getDineInOrders(filters?: DineInOrderFilters): Promise<PagedResult<OrderDto>> {
  const requestedPage = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? SERVER_ORDER_PAGE_SIZE;
  const firstPage = await getDineInOrdersPage({ ...filters, page: requestedPage, pageSize });

  // The default read feeds the All view and is deliberately bounded to recent rows. Only
  // server-filtered active/table reads and modified-since deltas may walk further pages: those
  // are the reads that can establish whether a table is safe to close. Explicit page requests
  // retain their single-page semantics for callers that genuinely own pagination.
  const firstPageHasNext = pageHasMore(firstPage, requestedPage);
  if (filters?.page !== undefined || !shouldWalkAllPages(filters) || requestedPage !== 1 || !firstPageHasNext) {
    return firstPage;
  }

  const itemsById = new Map(firstPage.items.map((order) => [order.id, order]));
  let page = requestedPage + 1;
  let hasNextPage: boolean = firstPageHasNext;
  while (hasNextPage && page <= SERVER_ORDER_MAX_PAGES) {
    const nextPage = await getDineInOrdersPage({ ...filters, page, pageSize });
    for (const order of nextPage.items) itemsById.set(order.id, order);
    hasNextPage = pageHasMore(nextPage, page);
    if (nextPage.items.length === 0) break;
    page += 1;
  }

  if (hasNextPage) {
    throw new Error('The waiter order list is too large to load safely');
  }

  const items = [...itemsById.values()];
  return {
    ...firstPage,
    items,
    page: 1,
    pageSize,
    hasNextPage: false,
    hasPreviousPage: false,
  };
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

export async function getOrderById(orderId: string): Promise<OrderDto> {
  const response = await apiClient.get<OrderDtoApiResponse>(`/api/orders/${orderId}`, {
    requireAuth: true,
  });

  if (!response.data) {
    throw new Error('Failed to fetch order');
  }

  return response.data;
}

export async function createServerOrder(
  tableNumber: number,
  items: CreateOrderItemDto[],
  customerName?: string,
  notes?: string,
): Promise<OrderDto> {
  const orderCommand: CreateOrderCommand = {
    type: OrderType.DineIn,
    tableNumber,
    items,
    customerName: customerName || `Table ${tableNumber}`,
    notes,
  };

  const response = await apiClient.post<OrderDtoApiResponse>('/api/Orders', orderCommand, { requireAuth: true });

  if (!response.data) {
    throw new Error('Failed to create order');
  }

  return response.data;
}
