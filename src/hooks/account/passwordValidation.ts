import type { TFunction } from 'i18next';
import { ApiError } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';

/**
 * The account page's password rules, as pure functions.
 *
 * They live beside `useAccountPassword` rather than inside it because the hook already carries the
 * two submit paths (`change-password` / `set-password`) and its 200-LOC limit is real. Nothing here
 * touches React.
 *
 * These are the page's OWN rules, unchanged from when they lived in `src/app/account/page.tsx`.
 * They are deliberately not `src/lib/passwordPolicy.ts`: that module mirrors the server's
 * `StrongPasswordValidator` (distinct-character and repeat rules included) and adopting it here
 * would change which passwords this form refuses — a separate change from adding the set-password
 * branch. The server remains authoritative either way; a password these rules let through and the
 * server refuses comes back as the server's own sentence.
 */

/** Which field a message belongs to. `form` is the section-level banner. */
// The pragma is required ON this line: detect-secrets' keyword heuristic reads `…Password… = '…'`
// as an assignment of a credential. These are field NAMES.
export type PasswordFieldKey = 'currentPassword' | 'newPassword' | 'confirmNewPassword' | 'form'; // pragma: allowlist secret

export type PasswordFieldErrors = Partial<Record<PasswordFieldKey, string>>;

export interface PasswordStrength {
  /** 0 = nothing to show, 1 = weak, 2 = medium, 3 = strong. */
  strength: number;
  /** The translated label rendered next to the bars. */
  text: string;
}

/** The four character classes the meter counts, on top of the length rule. */
const STRENGTH_CLASSES = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/];

/**
 * Same verdicts as the cascade this replaces, expressed once instead of five times.
 *
 * The original built a score and then re-tested `password.length >= 8` in every arm, which made
 * three of its five branches unreachable and the whole thing complex enough for the linter to
 * refuse it. The rules are unchanged: shorter than 8 is weak whatever it contains, and at 8+ the
 * score is 1 (for the length) plus one per class present.
 */
export function checkPasswordStrength(t: TFunction, password: string): PasswordStrength {
  if (!password) return { strength: 0, text: '' };
  if (password.length < 8) return { strength: 1, text: t('password_strength_weak', 'Weak') };

  const score = 1 + STRENGTH_CLASSES.filter((rule) => rule.test(password)).length;
  if (score <= 2) return { strength: 1, text: t('password_strength_weak', 'Weak') };
  if (score <= 4) return { strength: 2, text: t('password_strength_medium', 'Medium') };
  return { strength: 3, text: t('password_strength_strong', 'Strong') };
}

export interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/**
 * Validate the form for the submit path it is on.
 *
 * `requireCurrentPassword` is false for the set-password variant, where the account HAS no current
 * password: requiring one there would make the form unsubmittable for exactly the people it was
 * added for. Every other rule is shared — the server applies its own policy on both endpoints.
 */
export function validatePasswordForm(
  t: TFunction,
  values: PasswordFormValues,
  requireCurrentPassword: boolean,
): PasswordFieldErrors {
  const { currentPassword, newPassword, confirmNewPassword } = values;
  const errors: PasswordFieldErrors = {};

  if (requireCurrentPassword && !currentPassword)
    errors.currentPassword = t('field_required_error', {
      fieldName: t('current_password_label', 'Current Password'),
    });

  // One branch, not five. The original had a rule-by-rule cascade, but every arm passed the SAME
  // key (`password_security_rules_error`) with a different English default — and a default is only
  // reached when the key is MISSING, which it is not, in any of the ten bundles. So all five arms
  // always rendered the one sentence below; splitting them again would only re-create the illusion
  // that the message is specific.
  if (!newPassword) {
    errors.newPassword = t('field_required_error', { fieldName: t('new_password_label', 'New Password') });
  } else if (
    newPassword.length < 8 ||
    !/[A-Z]/.test(newPassword) ||
    !/[a-z]/.test(newPassword) ||
    !/\d/.test(newPassword) ||
    !/[^A-Za-z0-9]/.test(newPassword)
  ) {
    errors.newPassword = t(
      'password_security_rules_error',
      'Password must be at least 8 characters and include uppercase, lowercase, number, and a special character.',
    );
  }

  if (!confirmNewPassword)
    errors.confirmNewPassword = t('field_required_error', {
      fieldName: t('confirm_new_password_label', 'Confirm New Password'),
    });
  else if (newPassword && confirmNewPassword !== newPassword)
    errors.confirmNewPassword = t('passwords_do_not_match_error', 'New passwords do not match.');

  return errors;
}

/**
 * `ApiResponse.ErrorCode` for "this account already has a password" — the one refusal the
 * set-password form has to ACT on rather than merely print. Matched on the code and never on the
 * English sentence, which is the backend's to reword or localise
 * (`docs/handover/backend-auth-password.md`).
 */
export const PASSWORD_ALREADY_SET = 'PasswordAlreadySet'; // pragma: allowlist secret

export function isPasswordAlreadySet(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === PASSWORD_ALREADY_SET;
}

/**
 * What to show the user when a password write fails.
 *
 * The server's own sentence wins: "Password must contain at least one uppercase letter" and
 * "Incorrect current password" tell someone what to do, and the translated generic does not. The
 * middle arm is for `changePassword`, still a raw `fetch` that throws a plain `Error` carrying the
 * body's message — a shape `serverMessage` deliberately does not read. Only when both are silent
 * (a dead network, an HTML 502) does the translated fallback appear.
 */
export function passwordFailureMessage(t: TFunction, error: unknown, hasExistingPassword: boolean): string {
  const fallback = hasExistingPassword
    ? t('password_change_error', 'Could not change password. Please try again.')
    : t('set_password_failed', 'Could not set your password. Please try again.');
  return serverMessage(error) || (error instanceof Error ? error.message : '') || fallback;
}
