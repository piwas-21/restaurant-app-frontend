import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { ApiResponse } from '@/types/order';

export interface CashierPrintTarget {
  orderId?: string;
  serviceSessionId?: string;
  expectedVersion: number;
}
export interface CashierPrintJob {
  jobId: string;
  status: 'Queued' | 'Claimed' | 'Sent' | 'Failed' | 'Unknown' | 'Expired';
  isAutomatic: boolean;
  createdAt: string;
}
export async function queueCashierBill(target: CashierPrintTarget, operationId: string): Promise<CashierPrintJob> {
  const response = await apiClient.post<ApiResponse<CashierPrintJob>>(
    '/api/cashier-print-jobs',
    { ...target, operationId },
    { requireAuth: true },
  );
  if (!response.success) throwServerRefusal(response);
  if (!response.data) throw new Error('Print request unavailable');
  return response.data;
}
export async function getCashierPrintJob(jobId: string): Promise<CashierPrintJob> {
  const response = await apiClient.get<ApiResponse<CashierPrintJob>>(`/api/cashier-print-jobs/${jobId}`, {
    requireAuth: true,
  });
  if (!response.success) throwServerRefusal(response);
  if (!response.data) throw new Error('Print request unavailable');
  return response.data;
}
