import type { CustomerInfoField } from '@/components/order/GuestCustomerInfoFields';
import type { FormFieldRules } from '@/types/formFieldConfig';

/** Canonical render order of the checkout contact fields. */
const CONTACT_FIELD_ORDER: ReadonlyArray<CustomerInfoField> = ['name', 'email', 'phone'];

export interface MergedContactFields {
  /** Fields the contact form collects (renders), in canonical order. */
  fields: ReadonlyArray<CustomerInfoField>;
  /** Fields that must be non-empty to commit. Subset of `fields`. */
  requiredFields: ReadonlyArray<CustomerInfoField>;
}

/**
 * Merges the admin-configured `checkout_contact` rules with the active
 * flow's per-order-type floor (DineIn: name+email; Takeaway/Delivery:
 * +phone — the pickup/driver contact is operational, not configurable):
 *
 *   effective-required = config-required OR order-type-required
 *   shown              = config-visible  OR effective-required
 *
 * Config can ADD requiredness/visibility but never remove the order-type
 * floor, and a required field can never end up hidden. Mirrors the NOTE
 * on the backend `FormFieldRegistry` (the checkout-phone merge is
 * computed frontend-side).
 */
export function mergeContactFieldRules(
  orderTypeRequired: ReadonlyArray<CustomerInfoField>,
  rules: FormFieldRules,
): MergedContactFields {
  const isRequired = (field: CustomerInfoField) =>
    rules[field]?.isRequired === true || orderTypeRequired.includes(field);
  const isShown = (field: CustomerInfoField) => rules[field]?.isVisible !== false || isRequired(field);
  return {
    fields: CONTACT_FIELD_ORDER.filter(isShown),
    requiredFields: CONTACT_FIELD_ORDER.filter(isRequired),
  };
}
