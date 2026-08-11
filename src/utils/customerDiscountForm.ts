import type { TFunction } from 'i18next';
import type { CreateCustomerDiscountDto, UpdateCustomerDiscountDto } from '@/services/adminFidelityService';
import { serverMessages } from '@/utils/apiFormErrors';

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
    // Guard the empty-string case: a checked "valid from/until" toggle with no date picked yet
    // would make `new Date('').toISOString()` throw RangeError. Omit the field instead.
    validFrom: formData.hasValidFrom && formData.validFrom ? new Date(formData.validFrom).toISOString() : undefined,
    validUntil: formData.hasValidUntil && formData.validUntil ? new Date(formData.validUntil).toISOString() : undefined,
  };
}

/**
 * Translates a create/update failure into a user-facing message, surfacing the API's
 * specific error (user-not-found, duplicate, validation) when present.
 *
 * **It used to return the fallback for every input.** It unwrapped `error.response.data` — the
 * axios error envelope — and axios is not a dependency here, so `errorData` was always
 * `undefined` and the function returned on its second line. The user-not-found and
 * already-exists routing below, which is the whole reason it exists, had never run.
 *
 * `serverMessages` reads what `apiClient` actually throws. It also subsumes the three fallbacks
 * that followed: a per-field `errors` OBJECT is already flattened into `ApiError.errors` by
 * `apiClient`, and the summary `message` is what `serverMessages` returns when there is no array.
 */
export function parseCustomerDiscountError(error: unknown, isUpdate: boolean, userId: string, t: TFunction): string {
  const fallback = t(
    isUpdate ? 'failed_update_discount' : 'failed_create_discount',
    `Failed to ${isUpdate ? 'update' : 'create'} discount`,
  );

  // Matched PER ENTRY rather than on `[0]` or on the joined string. **This endpoint cannot
  // currently send more than one entry, and that is measured, not assumed:**
  // `CustomerDiscountsController` injects `ICustomerDiscountService` directly — no mediator, so
  // `ValidationBehavior` never runs — and nothing wires `AddFluentValidationAutoValidation`, so
  // `CustomerDiscountRuleValidators`' 17 rules are registered and never invoked. Every refusal is
  // the one-argument `ApiResponse.Failure(reason)`: exactly one entry. So per-entry matching is
  // defence against the shape changing, not a response to a live reorder.
  //
  // Given that, why not just join and match once? Because the join is the one option that is
  // actively WRONG: the user-not-found test is an AND of two independent `includes`, so "…user…"
  // in one entry and "…not found…" in another would satisfy it across a boundary neither entry
  // claims — rewording a refusal nobody made and interpolating a user id nothing complained about.
  //
  // Known and accepted: when a matcher DOES hit, the reworded sentence replaces every entry,
  // including ones it did not match. That is the loss #490 exists to stop, kept here because the
  // reword is the actionable sentence and the raw reason beside it would read as contradiction.
  const messages = serverMessages(error);
  if (messages.length === 0) return fallback;

  const matches = (predicate: (lower: string) => boolean) => messages.some((m) => predicate(m.toLowerCase()));

  if (matches((lower) => lower.includes('user') && lower.includes('not found'))) {
    return t(
      'user_not_found_error',
      'User with ID "{{userId}}" was not found. Please verify the user ID and try again.',
      {
        userId,
      },
    );
  }
  if (matches((lower) => lower.includes('already exists'))) {
    return t(
      'discount_already_exists_error',
      'A discount already exists for this user. Please edit the existing discount instead of creating a new one.',
    );
  }

  // 'invalid' and any other message both surface the server's own sentence directly — ALL of them,
  // joined the way the backend joins them, so a two-rule refusal does not queue the admin through
  // one reason at a time.
  return messages.join('; ');
}
