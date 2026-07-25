import { z } from 'zod';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';

// Allow various postal code formats: 4 digits (CH), alphanumeric (NL, DE, etc.)
const POSTAL_CODE_PATTERN = /^[A-Z0-9\s\-]{2,10}$/i;

/** The two admin-configurable delivery-address fields (street/postalCode/city are locked). */
type ConfigurableAddressField = 'country' | 'additionalInfo';

/**
 * A configurable field's schema, derived from the admin rules: enforced
 * (`min(1)`) only when the field is both visible and config-required — a
 * hidden field can't be filled in, so requiring it would brick the form
 * (the hook keeps the country default 'Switzerland' when hidden, so the
 * payload stays valid either way).
 */
function configurableField(fieldKey: ConfigurableAddressField, rules: FormFieldRules) {
  const rule = rules[fieldKey] ?? DEFAULT_FORM_FIELD_RULES[FORM_KEYS.deliveryAddress][fieldKey];
  const enforced = rule?.isVisible !== false && rule?.isRequired === true;
  return enforced ? z.string().trim().min(1, 'validation_field_required') : z.string().optional();
}

/**
 * Builds the checkout delivery-address schema from the admin-configured
 * `delivery_address` rules (D3). Locked fields (street/postalCode/city)
 * are always required; `country`/`additionalInfo` requiredness follows
 * the config. Error messages are i18n keys (matching the strings the
 * page used pre-extraction); the hook calls `safeParse` and surfaces
 * the first issue via `t(key, key)`.
 */
export function buildDeliveryAddressSchema(
  rules: FormFieldRules = DEFAULT_FORM_FIELD_RULES[FORM_KEYS.deliveryAddress],
) {
  return z.object({
    street: z.string().trim().min(1, 'street_required'),
    city: z.string().trim().min(1, 'city_required'),
    postalCode: z.string().trim().min(1, 'postal_code_required').regex(POSTAL_CODE_PATTERN, 'postal_code_invalid'),
    country: configurableField('country', rules),
    additionalInfo: configurableField('additionalInfo', rules),
  });
}

/**
 * Default-rules schema — today's behaviour (country/additionalInfo
 * optional). Also the safe fallback the hook lands on when the config
 * endpoint is unreachable (useCustomerFormFields serves the defaults).
 */
export const deliveryAddressSchema = buildDeliveryAddressSchema();

export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
