import { apiClient } from '@/utils/apiClient';
import type { FormFieldsDto, UpdateFormFieldConfigurationDto } from '@/types/formFieldConfig';

/**
 * API Response wrapper
 */
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

const ENDPOINTS = {
  GET_ALL: '/api/FormFieldConfiguration',
  UPDATE: '/api/FormFieldConfiguration',
};

export const formFieldConfigService = {
  /**
   * Get all customer form-field configurations, grouped per form (public endpoint —
   * customer-facing forms consult this before render).
   */
  async getAll(): Promise<FormFieldsDto[]> {
    const response = await apiClient.get<ApiResponse<FormFieldsDto[]>>(ENDPOINTS.GET_ALL);
    return response.data;
  },

  /**
   * Bulk update of configurable fields (admin only). Locked fields must be echoed
   * back unchanged (visible + required) — whole-form submits are tolerated.
   * Returns the full grouped configuration post-update.
   */
  async update(fields: UpdateFormFieldConfigurationDto[]): Promise<FormFieldsDto[]> {
    const response = await apiClient.put<ApiResponse<FormFieldsDto[]>>(ENDPOINTS.UPDATE, { fields });
    return response.data;
  },
};
