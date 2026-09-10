import type { ApiResponse } from '@/types/order';
import type { CreateOrderOperationalNoteCommand, OrderOperationalNoteDto } from '@/types/orderOperationalNote';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import { apiClient } from '@/utils/apiClient';

type OrderOperationalNoteListResponse = ApiResponse<OrderOperationalNoteDto[]>;
type OrderOperationalNoteResponse = ApiResponse<OrderOperationalNoteDto>;

export async function getOrderOperationalNotes(orderId: string): Promise<OrderOperationalNoteDto[]> {
  const response = await apiClient.get<OrderOperationalNoteListResponse>(`/api/orders/${orderId}/notes`, {
    requireAuth: true,
  });

  if (!response.success || !response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}

export async function createOrderOperationalNote(
  orderId: string,
  command: CreateOrderOperationalNoteCommand,
): Promise<OrderOperationalNoteDto> {
  const response = await apiClient.post<OrderOperationalNoteResponse>(`/api/orders/${orderId}/notes`, command, {
    requireAuth: true,
  });

  if (!response.success || !response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}
