/**
 * Order write endpoints: create, status update, cancel, soft-delete, focus toggle.
 * Extracted from orderService (Sprint 4/6 service split); behaviour unchanged.
 */

import { apiClient } from '@/utils/apiClient';
import {
  CreateOrderCommand,
  CreateOrderFromBasketCommand,
  OrderDto,
  UpdateOrderStatusCommand,
  CancelOrderCommand,
  ToggleFocusOrderCommand,
  OrderDtoApiResponse,
  ApiResponse,
} from '@/types/order';

/**
 * Create a new order
 */
export async function createOrder(command: CreateOrderCommand): Promise<OrderDto> {
  try {
    const response = await apiClient.post<OrderDtoApiResponse>('/api/Orders', command, { requireAuth: false });
    if (!response.data) {
      throw new Error('Failed to create order');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

/**
 * Create an order from the user's persisted basket. The server derives the order items from the
 * basket (resolved via the X-Session-Id header that apiClient attaches), so the client no longer
 * builds the item payload — see backend #157 (menu-bundles redesign, slice 5).
 */
export async function createOrderFromBasket(command: CreateOrderFromBasketCommand): Promise<OrderDto> {
  try {
    const response = await apiClient.post<OrderDtoApiResponse>('/api/Orders/from-basket', command, {
      requireAuth: false,
    });
    if (!response.data) {
      throw new Error('Failed to create order');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating order from basket:', error);
    throw error;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: string, command: UpdateOrderStatusCommand): Promise<OrderDto> {
  try {
    const response = await apiClient.put<OrderDtoApiResponse>(`/api/Orders/${orderId}/status`, command, {
      requireAuth: true,
    });
    if (!response.data) {
      throw new Error('Failed to update order status');
    }
    return response.data;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

/**
 * Cancel order
 */
export async function cancelOrder(orderId: string, command: CancelOrderCommand): Promise<OrderDto> {
  try {
    const response = await apiClient.post<OrderDtoApiResponse>(`/api/Orders/${orderId}/cancel`, command, {
      requireAuth: true,
    });
    if (!response.data) {
      throw new Error('Failed to cancel order');
    }
    return response.data;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
}

/**
 * Delete an order (soft delete - Admin only)
 */
export async function deleteOrder(orderId: string): Promise<void> {
  try {
    const response = await apiClient.delete<ApiResponse<boolean>>(`/api/Orders/${orderId}`, { requireAuth: true });

    if (!response.success) {
      throw new Error(response.message || 'Failed to delete order');
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
}

/**
 * Toggle focus order status
 */
export async function toggleFocusOrder(orderId: string, command: ToggleFocusOrderCommand): Promise<OrderDto> {
  try {
    const response = await apiClient.put<OrderDtoApiResponse>(`/api/Orders/${orderId}/focus`, command, {
      requireAuth: true,
    });
    if (!response.data) {
      throw new Error('Failed to toggle focus order');
    }
    return response.data;
  } catch (error) {
    console.error('Error toggling focus order:', error);
    throw error;
  }
}
