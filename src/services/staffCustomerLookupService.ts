import type { ApiResponse } from '@/types/reservation';
import type { StaffCustomerLookup } from '@/types/staffCustomer';
import { apiClient } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';

const CUSTOMER_LOOKUP_PATH = '/api/User/customer-lookup';

export async function lookupStaffCustomers(search: string, pageSize = 10): Promise<StaffCustomerLookup[]> {
  const normalized = search.trim();
  if (normalized.length < 2) return [];
  const query = new URLSearchParams({ search: normalized, pageSize: String(pageSize) });
  const response = await apiClient.get<ApiResponse<StaffCustomerLookup[]>>(`${CUSTOMER_LOOKUP_PATH}?${query}`, {
    requireAuth: true,
  });
  if (response.success !== true || !response.data) throwServerRefusal(response);
  return response.data;
}
