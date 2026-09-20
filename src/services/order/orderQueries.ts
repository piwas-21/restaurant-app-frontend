/**
 * Order read endpoints: listing, lookup, focus orders, and the Z-Report.
 * Extracted from orderService (Sprint 4/6 service split); behaviour unchanged.
 */

import { apiClient } from '@/utils/apiClient';
import {
  GuestOrderStatusDto,
  GuestOrderStatusApiResponse,
  OrderDto,
  OrderQueryFilters,
  FocusOrdersQueryFilters,
  OrderDtoApiResponse,
  OrderDtoListApiResponse,
  OrderDtoPagedResultApiResponse,
  PagedResult,
  ZReportDto,
  ZReportApiResponse,
} from '@/types/order';
import { buildQueryString } from './orderQuery';

/**
 * Get orders for the current authenticated user
 */
export async function getMyOrders(filters?: Partial<OrderQueryFilters>): Promise<PagedResult<OrderDto>> {
  try {
    const endpoint = `/api/Orders${buildQueryString(filters)}`;
    const response = await apiClient.get<OrderDtoPagedResultApiResponse>(endpoint, { requireAuth: true });

    if (!response.data) {
      throw new Error('Failed to fetch orders');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching my orders:', error);
    throw error;
  }
}

/**
 * Get orders with optional filters (status, payment status, date range, etc.)
 */
export async function getOrders(filters?: OrderQueryFilters): Promise<PagedResult<OrderDto>> {
  try {
    const endpoint = `/api/Orders${buildQueryString(filters)}`;
    const response = await apiClient.get<OrderDtoPagedResultApiResponse>(endpoint, { requireAuth: true });

    if (!response.data) {
      throw new Error('Failed to fetch orders');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

/**
 * Get order by ID
 */
export async function getOrderById(orderId: string): Promise<OrderDto> {
  try {
    const response = await apiClient.get<OrderDtoApiResponse>(`/api/Orders/${orderId}`);
    if (!response.data) {
      throw new Error('Failed to fetch order');
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
}

/**
 * Anonymous guest order watch (order confirmation flows, backend S1). Shares the checkout-status
 * rate bucket, so the ONLY caller is the guest confirmation screen's slow poll (>= 15s). A wrong
 * or missing token is a 404, which the caller renders as "order not found", not as an error to
 * retry. The backend currently accepts the bearer only as a query parameter, so it can appear
 * in API access logs; it is intentionally a separate read-only token for this four-field
 * projection. The browser PAGE keeps it in the URL fragment so it is not sent as a referrer.
 */
export async function getGuestOrderStatus(orderId: string, token: string): Promise<GuestOrderStatusDto> {
  const params = new URLSearchParams({ orderId, token });
  const response = await apiClient.get<GuestOrderStatusApiResponse>(`/api/Orders/guest-status?${params}`);
  if (!response.data) {
    throw new Error('Failed to fetch guest order status');
  }
  return response.data;
}

/**
 * Get focus orders
 */
export async function getFocusOrders(filters?: FocusOrdersQueryFilters): Promise<OrderDto[]> {
  try {
    const endpoint = `/api/Orders/focus${buildQueryString(filters)}`;
    const response = await apiClient.get<OrderDtoListApiResponse>(endpoint, { requireAuth: true });

    return response.data || [];
  } catch (error) {
    console.error('Error fetching focus orders:', error);
    throw error;
  }
}

/**
 * Get Z-Report (end-of-day financial summary) for a specific date.
 * @param date - ISO date string (YYYY-MM-DD), defaults to today on server
 */
export async function getZReport(date?: string): Promise<ZReportDto> {
  try {
    const endpoint = `/api/Orders/z-report${buildQueryString(date ? { date } : undefined)}`;
    const response = await apiClient.get<ZReportApiResponse>(endpoint, { requireAuth: true });
    if (!response.data) {
      throw new Error('Failed to fetch Z-Report');
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching Z-Report:', error);
    throw error;
  }
}
