import type { TFunction } from 'i18next';
import type { CreateCustomerDiscountDto, UpdateCustomerDiscountDto } from '@/services/adminFidelityService';

/** The editable shape backing CustomerDiscountForm (all numeric fields are string-typed inputs). */
export interface CustomerDiscountFormData {
  userId: string;
  name: string;
  discountType: 'Percentage' | 'FixedAmount';
  discountValue: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  hasMaxOrderAmount: boolean;
  maxUsageCount: string;
  hasMaxUsageCount: boolean;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  hasValidFrom: boolean;
  hasValidUntil: boolean;
}

/** Returns the first validation error message, or null when the form is valid. */
export function validateCustomerDiscountForm(formData: CustomerDiscountFormData, t: TFunction): string | null {
  if (!formData.userId.trim()) return t('user_id_required', 'User ID is required');
  if (!formData.name.trim()) return t('name_required', 'Name is required');

  const discountValue = parseFloat(formData.discountValue);
  if (!formData.discountValue || isNaN(discountValue) || discountValue <= 0) {
    return t('discount_value_must_be_greater_than_zero', 'Discount value must be greater than 0');
  }
  if (formData.discountType === 'Percentage' && discountValue > 100) {
    return t('percentage_discount_cannot_exceed_100', 'Percentage discount cannot exceed 100%');
  }

  const minOrderAmount = parseFloat(formData.minOrderAmount || '0');
  if (isNaN(minOrderAmount) || minOrderAmount < 0) {
    return t('min_order_amount_cannot_be_negative', 'Minimum order amount cannot be negative');
  }

  if (formData.hasMaxOrderAmount) {
    const maxOrderAmount = parseFloat(formData.maxOrderAmount);
    if (!formData.maxOrderAmount || isNaN(maxOrderAmount) || maxOrderAmount <= minOrderAmount) {
      return t('max_order_amount_must_be_greater_than_min', 'Maximum order amount must be greater than minimum');
    }
  }

  if (formData.hasMaxUsageCount) {
    const maxUsageCount = parseInt(formData.maxUsageCount);
    if (!formData.maxUsageCount || isNaN(maxUsageCount) || maxUsageCount <= 0) {
      return t('max_usage_count_must_be_greater_than_zero', 'Max usage count must be greater than 0');
    }
  }

  if (formData.hasValidFrom && formData.hasValidUntil) {
    const from = new Date(formData.validFrom);
    const until = new Date(formData.validUntil);
    if (until <= from) {
      return t('valid_until_must_be_after_valid_from', 'Valid until date must be after valid from date');
    }
  }
  return null;
}

/** Maps the form state to the create/update API DTO. */
export function buildCustomerDiscountDto(
  formData: CustomerDiscountFormData,
): CreateCustomerDiscountDto | UpdateCustomerDiscountDto {
  return {
    userId: formData.userId,
    name: formData.name,
    discountType: formData.discountType,
    discountValue: parseFloat(formData.discountValue),
    minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : undefined,
    maxOrderAmount:
      formData.hasMaxOrderAmount && formData.maxOrderAmount ? parseFloat(formData.maxOrderAmount) : undefined,
    maxUsageCount: formData.hasMaxUsageCount && formData.maxUsageCount ? parseInt(formData.maxUsageCount) : undefined,
    isActive: formData.isActive,
    validFrom: formData.hasValidFrom ? new Date(formData.validFrom).toISOString() : undefined,
    validUntil: formData.hasValidUntil ? new Date(formData.validUntil).toISOString() : undefined,
  };
}

/**
 * Translates a create/update failure into a user-facing message, surfacing the API's
 * specific error (user-not-found, duplicate, validation) when present. Carried over from the
 * inline catch block; the `error` is typed `unknown` (was `any`) and narrowed.
 */
export function parseCustomerDiscountError(error: unknown, isUpdate: boolean, userId: string, t: TFunction): string {
  const fallback = t(
    isUpdate ? 'failed_update_discount' : 'failed_create_discount',
    `Failed to ${isUpdate ? 'update' : 'create'} discount`,
  );

  const errorData = (error as { response?: { data?: unknown } })?.response?.data;
  if (errorData == null) return fallback;

  const data = errorData as { errors?: unknown; message?: string };

  // Our API format: an errors array with a leading human-readable message.
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const firstError = String(data.errors[0]);
    const lower = firstError.toLowerCase();
    if (lower.includes('user') && lower.includes('not found')) {
      return t(
        'user_not_found_error',
        'User with ID "{{userId}}" was not found. Please verify the user ID and try again.',
        { userId },
      );
    }
    if (lower.includes('already exists')) {
      return t(
        'discount_already_exists_error',
        'A discount already exists for this user. Please edit the existing discount instead of creating a new one.',
      );
    }
    // 'invalid' and any other message both surface the first error directly.
    return firstError;
  }

  // Fallbacks: a plain string body, a message field, or a validation-errors object.
  if (typeof errorData === 'string') return errorData;
  if (data.message) return data.message;
  if (data.errors && typeof data.errors === 'object') {
    return Object.values(data.errors as Record<string, unknown>)
      .flat()
      .join(', ');
  }

  return fallback;
}
