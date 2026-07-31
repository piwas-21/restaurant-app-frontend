import { apiClient } from '@/utils/apiClient';
import type {
  ApiResponse,
  LogoVariant,
  RestaurantInfoDto,
  RestaurantPhoneNumberDto,
  UpdateRestaurantInfoCommand,
  AddPhoneNumberCommand,
  UpdatePhoneNumberCommand,
} from '@/types/restaurantInfo';

const BASE = '/api/restaurant-info';

/** Public read — no auth required. */
export const getRestaurantInfo = async () => {
  return apiClient.get<ApiResponse<RestaurantInfoDto>>(BASE);
};

/** Admin only — full upsert of the singleton's own fields. */
export const updateRestaurantInfo = async (data: UpdateRestaurantInfoCommand) => {
  return apiClient.put<ApiResponse<RestaurantInfoDto>>(BASE, data, { requireAuth: true });
};

/** Admin only — append a new phone. */
export const addPhoneNumber = async (data: AddPhoneNumberCommand) => {
  return apiClient.post<ApiResponse<RestaurantPhoneNumberDto>>(`${BASE}/phones`, data, {
    requireAuth: true,
  });
};

/** Admin only — replace by id. Route id wins over body id server-side. */
export const updatePhoneNumber = async (id: string, data: UpdatePhoneNumberCommand) => {
  return apiClient.put<ApiResponse<RestaurantPhoneNumberDto>>(`${BASE}/phones/${id}`, data, {
    requireAuth: true,
  });
};

/** Admin only — hard delete. */
export const deletePhoneNumber = async (id: string) => {
  return apiClient.delete<ApiResponse<string>>(`${BASE}/phones/${id}`, { requireAuth: true });
};

/**
 * Admin only — replace one of the restaurant's logos (SOFRA-ONBOARDING-PLAN O6).
 *
 * The form part is named `logo` to match the backend's `UpdateRestaurantLogoRequest.Logo`;
 * a mismatch binds null and the API answers "No image file provided" inside a 200 envelope,
 * so it fails as a snackbar rather than as an HTTP error.
 */
export const uploadRestaurantLogo = async (variant: LogoVariant, file: File) => {
  const formData = new FormData();
  formData.append('logo', file);
  return apiClient.putFormData<ApiResponse<RestaurantInfoDto>>(`${BASE}/logo/${variant}`, formData);
};

/** Admin only — clear one logo. Not an error state: the chrome falls back to the name. */
export const deleteRestaurantLogo = async (variant: LogoVariant) => {
  return apiClient.delete<ApiResponse<RestaurantInfoDto>>(`${BASE}/logo/${variant}`, {
    requireAuth: true,
  });
};
