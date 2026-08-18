import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/order';
import type { PaymentsOnboardingDto } from '@/types/paymentsOnboarding';

/**
 * Where this restaurant stands on taking card payments (SOFRA-PAYMENTS-PLAN §9 P7a).
 *
 * ADMIN-only, and gated on the `online-payments` module: a tenant that did not buy it gets a
 * **404 carrying `errorCode: ModuleNotEnabled`**, which is normal operation rather than a fault.
 * The sibling `/api/payments/availability` is the anonymous one and answers a single boolean —
 * they are different endpoints on purpose, and this one must never be substituted for it on a
 * page a diner can reach.
 */
export const getPaymentsOnboarding = async () =>
  apiClient.get<ApiResponse<PaymentsOnboardingDto>>('/api/payments/onboarding', { requireAuth: true });
