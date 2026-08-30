import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/order';
import type { TenantPartnerDto } from '@/types/tenantPartner';

/**
 * Public read — no auth required (SOFRA-PARTNER-PLAN §11d, S4a). Modelled on
 * `GET /api/tenant/modules`: founder/operator-controlled per-tenant data that the frontend
 * cannot read itself, because its own knobs are `NEXT_PUBLIC_*` and baked into the
 * per-tenant image at build time.
 */
export const getTenantPartner = async () => {
  return apiClient.get<ApiResponse<TenantPartnerDto>>('/api/tenant/partner');
};
