import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type { ApiResponse, OrderDto } from '@/types/order';
import type { BillChargeConfiguration, BillChargeInput } from '@/types/billCharge';

function data<T>(result: ApiResponse<T>): T {
  if (result.success !== true || result.data == null) throwServerRefusal(result);
  return result.data;
}
export async function getBillCharges(): Promise<BillChargeConfiguration> {
  return data(await apiClient.get<ApiResponse<BillChargeConfiguration>>('/api/bill-charges', { requireAuth: true }));
}
export async function saveBillCharges(configuration: BillChargeConfiguration): Promise<BillChargeConfiguration> {
  return data(
    await apiClient.put<ApiResponse<BillChargeConfiguration>>('/api/bill-charges', configuration, {
      requireAuth: true,
    }),
  );
}
export async function addOrderBillCharges(
  orderId: string,
  expectedVersion: number,
  operationId: string,
  charges: readonly BillChargeInput[],
): Promise<OrderDto> {
  return data(
    await apiClient.post<ApiResponse<OrderDto>>(
      `/api/bill-charges/orders/${encodeURIComponent(orderId)}`,
      { expectedVersion, operationId, charges },
      { requireAuth: true },
    ),
  );
}
