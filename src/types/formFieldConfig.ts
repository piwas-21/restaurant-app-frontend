/**
 * Customer form-field configuration types.
 *
 * Mirrors backend `Features/Settings/FormFields/Dtos/` (restaurant-app-backend #207):
 * admins configure which fields customer-facing forms show and require.
 * Locked fields come from the server-side registry and are always
 * visible + required (the admin cannot change them).
 */

/** One field of a customer form as served by GET /api/FormFieldConfiguration. */
export interface FormFieldConfigurationDto {
  fieldKey: string;
  isVisible: boolean;
  isRequired: boolean;
  isLocked: boolean;
  displayOrder: number;
}

/** All fields of one customer-facing form, ordered by displayOrder. */
export interface FormFieldsDto {
  formKey: string;
  fields: FormFieldConfigurationDto[];
}

/** One field change in the PUT /api/FormFieldConfiguration bulk update. */
export interface UpdateFormFieldConfigurationDto {
  formKey: string;
  fieldKey: string;
  isVisible: boolean;
  isRequired: boolean;
}

/** The form keys the backend registry defines. */
export const FORM_KEYS = {
  reservation: 'reservation',
  checkoutContact: 'checkout_contact',
  deliveryAddress: 'delivery_address',
} as const;

export type FormKey = (typeof FORM_KEYS)[keyof typeof FORM_KEYS];

/** Per-field effective rule consumed by customer-facing forms. */
export interface FieldRule {
  isVisible: boolean;
  isRequired: boolean;
}

/** fieldKey → rule for one form. */
export type FormFieldRules = Record<string, FieldRule>;

const visible = (isRequired: boolean): FieldRule => ({ isVisible: true, isRequired });

/**
 * Defaults mirroring the backend registry (`FormFieldRegistry.cs`) — which in
 * turn mirrors today's frontend behaviour. Used as the safe fallback when the
 * config endpoint is unreachable or returns nothing: a broken config endpoint
 * must never break a customer form.
 */
export const DEFAULT_FORM_FIELD_RULES: Record<FormKey, FormFieldRules> = {
  [FORM_KEYS.reservation]: {
    customerName: visible(true),
    customerEmail: visible(true),
    customerPhone: visible(false),
    specialRequests: visible(false),
  },
  [FORM_KEYS.checkoutContact]: {
    name: visible(true),
    email: visible(true),
    phone: visible(false),
  },
  [FORM_KEYS.deliveryAddress]: {
    street: visible(true),
    postalCode: visible(true),
    city: visible(true),
    country: visible(false),
    additionalInfo: visible(false),
  },
};
