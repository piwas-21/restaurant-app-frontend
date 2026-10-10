import { apiClient } from '@/utils/apiClient';
import { TENANT_BRANDING_CONFIG } from '@/lib/config';
import type { ApiResponse } from '@/types/order';
import type { TenantPartnerDto } from '@/types/tenantPartner';

/** Public attribution has its own bounded request, independent of login/session recovery. */
export const getTenantPartner = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TENANT_BRANDING_CONFIG.requestTimeoutMs);
  try {
    return await apiClient.get<ApiResponse<TenantPartnerDto>>('/api/tenant/partner', {
      signal: controller.signal,
      skipAuth: true,
      skipSession: true,
    });
  } finally {
    clearTimeout(timer);
  }
};
