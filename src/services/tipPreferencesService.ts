import { apiClient } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/order';
import type { TipPreferences } from '@/types/tipPreferences';

export const updateTipPreferences = (data: TipPreferences) =>
  apiClient.put<ApiResponse<TipPreferences>>('/api/restaurant-info/tips', data, { requireAuth: true });
