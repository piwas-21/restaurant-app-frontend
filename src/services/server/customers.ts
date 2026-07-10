/**
 * Server flow — customer search, fidelity points, and discount rules.
 * Split from `serverService.ts` (Sprint 2 frontend baseline ratchet).
 */

import { apiClient } from '@/utils/apiClient';
import { ApiResponse } from '@/types/reservation';

const POINTS_PER_CURRENCY_UNIT = 100;

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber?: string;
  role: string;
  discountPercentage: number;
  isDiscountActive: boolean;
  orderLimitAmount: number;
}

export interface FidelityPointBalanceDto {
  id: string;
  userId: string;
  currentPoints: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  lastUpdated: string;
}

export interface CustomerDiscountRuleDto {
  id: string;
  userId: string;
  name: string;
  discountType: 'Percentage' | 'FixedAmount';
  discountValue: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  maxUsageCount?: number;
  usageCount: number;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
}

export async function searchUsers(query: string, pageSize: number = 10): Promise<UserDto[]> {
  if (!query || query.length < 2) return [];

  const params = new URLSearchParams({
    Search: query,
    Role: 'Customer',
    IsDeleted: 'false',
    PageSize: pageSize.toString(),
  });

  const response = await apiClient.get<ApiResponse<{ items: UserDto[] }>>(`/api/User/users?${params}`, {
    requireAuth: true,
  });

  return response.data?.items || [];
}

export async function getUserFidelityBalance(userId: string): Promise<FidelityPointBalanceDto | null> {
  try {
    const response = await apiClient.get<ApiResponse<FidelityPointBalanceDto>>(
      `/api/FidelityPoints/balance/${userId}`,
      { requireAuth: true },
    );
    return response.data || null;
  } catch (error) {
    console.error('Failed to fetch user fidelity balance:', error);
    return null;
  }
}

export async function getUserDiscountRules(userId: string): Promise<CustomerDiscountRuleDto[]> {
  try {
    const response = await apiClient.get<ApiResponse<CustomerDiscountRuleDto[]>>(
      `/api/admin/CustomerDiscounts?userId=${userId}&activeOnly=true`,
      { requireAuth: true },
    );
    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch user discount rules:', error);
    return [];
  }
}

/** 100 points = 1 currency unit. */
export function calculateDiscountFromPoints(points: number): number {
  return points / POINTS_PER_CURRENCY_UNIT;
}

/** 1 currency unit = 1 point. */
export function calculatePointsToEarn(orderTotal: number): number {
  return Math.floor(orderTotal);
}
