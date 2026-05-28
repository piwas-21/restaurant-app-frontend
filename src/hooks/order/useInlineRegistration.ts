'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { registerCustomer } from '@/services/authService';
import { trackEvent } from '@/lib/analytics';
import {
  validateRegisterField,
  type RegisterField,
  type RegisterFieldsErrors,
  type RegisterFieldsValue,
} from '@/components/order/GuestCustomerInfoFields';
import {
  isDuplicateEmailError,
  isDuplicateEmailResponse,
  type RegisterCustomerFailure,
} from './duplicateEmailDetection';

const EMPTY_REGISTER_ERRORS: RegisterFieldsErrors = { password: '', confirmPassword: '' };
/** Long enough for users to read both lines of the success/failure toast. */
const TOAST_DURATION_MS = 6000;

export interface InlineRegistrationOutcome {
  /**
   * 'ok' on success or skip; 'invalid' when client-side validation
   * fails (caller should keep modal open to surface inline errors);
   * 'duplicate' when the email is already registered (caller pins the
   * error to the email field via `setEmailError`).
   */
  status: 'ok' | 'invalid' | 'duplicate';
}

export interface UseInlineRegistrationResult {
  wantsRegister: boolean;
  setWantsRegister: (next: boolean) => void;
  registerValue: RegisterFieldsValue;
  registerErrors: RegisterFieldsErrors;
  setRegisterField: (field: RegisterField, next: string) => void;
  blurRegisterField: (field: RegisterField) => void;
  /** True while the inline register-customer call is in flight. */
  isRegistering: boolean;
  /**
   * Run the registration POST when `wantsRegister` is true; no-op
   * otherwise. Validates passwords, fires the call, and returns an
   * outcome the caller maps to "close modal" / "stay open with error".
   * Per option-A flow, the order proceeds as guest regardless of
   * registration outcome — non-blocking errors are toasted, not pinned.
   */
  registerIfRequested: (info: { name: string; email: string }) => Promise<InlineRegistrationOutcome>;
}

/**
 * Inline-registration sub-hook for the order-type modals
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.g). Extracted from
 * `useGuestCustomerInfo` so the parent hook stays under the §4 LOC
 * limit. State is owned here; the parent composes both into the
 * single facade the modals consume.
 *
 * The endpoint at /api/User/register/customer may write tokens to
 * localStorage on success — we clear them after, since the user has
 * not yet verified their email and a half-authenticated state breaks
 * smart-skip's profile fetch downstream.
 */
export function useInlineRegistration(): UseInlineRegistrationResult {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [wantsRegister, setWantsRegister] = useState(false);
  const [registerValue, setRegisterValue] = useState<RegisterFieldsValue>({ password: '', confirmPassword: '' });
  const [registerErrors, setRegisterErrors] = useState<RegisterFieldsErrors>(EMPTY_REGISTER_ERRORS);
  const [isRegistering, setIsRegistering] = useState(false);

  const setRegisterField = useCallback((field: RegisterField, next: string) => {
    setRegisterValue((prev) => ({ ...prev, [field]: next }));
    setRegisterErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  }, []);

  const blurRegisterField = useCallback(
    (field: RegisterField) => {
      const other = field === 'password' ? registerValue.confirmPassword : registerValue.password;
      const err = validateRegisterField(field, registerValue[field], other, t);
      setRegisterErrors((prev) => ({ ...prev, [field]: err }));
    },
    [registerValue, t],
  );

  const registerIfRequested = useCallback(
    async ({ name, email }: { name: string; email: string }): Promise<InlineRegistrationOutcome> => {
      if (!wantsRegister) return { status: 'ok' };

      const pwErr = validateRegisterField('password', registerValue.password, registerValue.confirmPassword, t);
      const cpErr = validateRegisterField('confirmPassword', registerValue.confirmPassword, registerValue.password, t);
      setRegisterErrors({ password: pwErr, confirmPassword: cpErr });
      if (pwErr || cpErr) return { status: 'invalid' };

      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ').trim();
      if (!lastName) return { status: 'invalid' };

      setIsRegistering(true);
      try {
        const result = await registerCustomer({
          firstName,
          lastName,
          email,
          password: registerValue.password,
          confirmPassword: registerValue.confirmPassword,
        });
        if (result?.success) {
          // The order continues as guest (option A): clear any tokens
          // the service auto-stored — the account is unverified and
          // can't safely back the smart-skip profile fetch yet.
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
          }
          enqueueSnackbar(
            t('account_created_check_email', 'Account created! Check your email to activate it for fidelity points.'),
            { variant: 'success', autoHideDuration: TOAST_DURATION_MS },
          );
          // Funnel event — fires only when the backend confirmed the
          // register call (not on the duplicate / unknown-failure paths
          // below). loggedIn is always false here: option-A flow strips
          // any auto-stored tokens above, so the order continues as guest.
          trackEvent('register_inline_completed', { loggedIn: false });
          return { status: 'ok' };
        }
        if (isDuplicateEmailResponse(result as RegisterCustomerFailure)) {
          return { status: 'duplicate' };
        }
        // Unknown failure — toast and continue as guest.
        enqueueSnackbar(
          t(
            'account_creation_failed_continuing',
            'Could not create your account, but your order will continue as guest.',
          ),
          { variant: 'warning', autoHideDuration: TOAST_DURATION_MS },
        );
        return { status: 'ok' };
      } catch (err) {
        // Future-proofing: if a later `apiClient` refactor starts throwing on
        // non-2xx, surface duplicate-email as the inline error here too rather
        // than silently degrading to the generic toast (issue #1).
        if (isDuplicateEmailError(err)) {
          return { status: 'duplicate' };
        }
        console.warn('Inline registration failed:', err);
        enqueueSnackbar(
          t(
            'account_creation_failed_continuing',
            'Could not create your account, but your order will continue as guest.',
          ),
          { variant: 'warning', autoHideDuration: TOAST_DURATION_MS },
        );
        return { status: 'ok' };
      } finally {
        setIsRegistering(false);
      }
    },
    [wantsRegister, registerValue, t, enqueueSnackbar],
  );

  return {
    wantsRegister,
    setWantsRegister,
    registerValue,
    registerErrors,
    setRegisterField,
    blurRegisterField,
    isRegistering,
    registerIfRequested,
  };
}
