import type { TFunction } from 'i18next';
import type { GuestCustomerInfoErrors } from '@/components/order/GuestCustomerInfoFields';
import type { InlineRegistrationOutcome } from './useInlineRegistration';

/**
 * Maps a failed inline-registration outcome onto the contact-field
 * errors (returns `null` when the outcome is 'ok' — caller proceeds).
 * Extracted from `useGuestCustomerInfo.commit()` to keep that hook
 * under the §4 LOC limit; pure so the branch mapping is unit-testable.
 */
export function registrationOutcomeErrors(
  outcome: InlineRegistrationOutcome,
  trimmedName: string,
  prev: GuestCustomerInfoErrors,
  t: TFunction,
): GuestCustomerInfoErrors | null {
  if (outcome.status === 'invalid') {
    // Sub-hook already populated registerErrors; ensure the name field
    // shows guidance when split-name validation fails (single-token name).
    return {
      ...prev,
      name:
        prev.name ||
        (trimmedName.split(' ').filter(Boolean).length < 2
          ? t('register_full_name_help', 'Please enter your full name (first and last)')
          : prev.name),
    };
  }
  if (outcome.status === 'duplicate') {
    return {
      ...prev,
      email: t('email_already_registered', 'An account with this email already exists. Please log in.'),
    };
  }
  return null;
}
