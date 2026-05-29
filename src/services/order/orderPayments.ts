/**
 * Order payment sub-resource endpoints: add payment, refund payment.
 * Extracted from orderService (Sprint 4/6 service split); behaviour unchanged.
 */

import { apiClient } from '@/utils/apiClient';
import {
  AddPaymentToOrderCommand,
  RefundPaymentCommand,
  OrderPaymentDto,
  OrderPaymentDtoApiResponse,
} from '@/types/order';

/**
 * Add payment to order
 */
export async function addPaymentToOrder(orderId: string, command: AddPaymentToOrderCommand): Promise<OrderPaymentDto> {
  try {
    const response = await apiClient.post<OrderPaymentDtoApiResponse>(`/api/Orders/${orderId}/payments`, command, {
      requireAuth: true,
    });
    if (!response.data) {
      throw new Error('Failed to add payment');
    }
    return response.data;
  } catch (error) {
    console.error('Error adding payment:', error);
    throw error;
  }
}

/**
 * Refund payment
 */
export async function refundPayment(
  orderId: string,
  paymentId: string,
  command: RefundPaymentCommand,
): Promise<OrderPaymentDto> {
  try {
    const response = await apiClient.post<OrderPaymentDtoApiResponse>(
      `/api/Orders/${orderId}/payments/${paymentId}/refund`,
      command,
      { requireAuth: true },
    );
    if (!response.data) {
      throw new Error('Failed to refund payment');
    }
    return response.data;
  } catch (error) {
    console.error('Error refunding payment:', error);
    throw error;
  }
}
