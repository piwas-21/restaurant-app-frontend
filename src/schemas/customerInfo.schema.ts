import { z } from 'zod';

const NAME_MIN = 2;
const NAME_MAX = 100;
// Loose phone pattern preserved from the pre-extraction page: any
// combination of `+`, whitespace, dash, parens, digits — 5+ chars total.
// Optional field; empty string passes.
const PHONE_PATTERN = /^[+\s\-()0-9]{5,}$/;

/**
 * Minimum password length for inline-registration in the order-type
 * modals (BUGS-IMPROVEMENTS-PLAN §C1.5.g). Mirrors the backend
 * `customerRegistrationSchema` rule (`password: z.string().min(6)`)
 * — keep these aligned if either side moves.
 */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Schema for the checkout customer-info form. Error keys are i18n keys
 * (matching the strings the page used pre-extraction so translations
 * don't need to change). Hook resolves them via `t(key, fallback)`.
 *
 * Per-field validation on blur: callers safeParse a single field via
 * `customerInfoSchema.shape.<field>.safeParse(value)` and surface the
 * first issue.
 */
export const customerInfoSchema = z.object({
  name: z.string().trim().min(1, 'name_required').min(NAME_MIN, 'name_too_short').max(NAME_MAX, 'name_too_long'),
  email: z.string().trim().min(1, 'email_required').email('email_invalid'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'phone_invalid'),
});

/**
 * Per-field schemas for the §C1.5.g inline-registration password fields.
 * Caller composes these with a cross-field equality check at commit time
 * (see `validateRegisterField`) — splitting per field avoids re-running
 * an `.refine` on every keystroke for the dependent confirmPassword.
 */
export const registerFieldsSchema = {
  password: z.string().min(1, 'field_required').min(MIN_PASSWORD_LENGTH, 'password_too_short'),
  confirmPassword: z.string().min(1, 'field_required').min(MIN_PASSWORD_LENGTH, 'password_too_short'),
} as const;

export type CustomerInfoInput = z.infer<typeof customerInfoSchema>;
