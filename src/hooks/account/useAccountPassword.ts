'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changePassword, hasPassword, setPassword } from '@/services/authService';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import {
  checkPasswordStrength,
  isPasswordAlreadySet,
  passwordFailureMessage,
  validatePasswordForm,
  type PasswordFieldErrors,
} from '@/hooks/account/passwordValidation';

/**
 * The account page's password section: state, validation and the TWO submit paths.
 *
 * An account created with Google or Apple has no password at all, so `change-password` — which
 * verifies `currentPassword` — can never succeed for it. `GET /api/Auth/has-password` says which
 * account this is, and the section renders accordingly: the change form when it has one, a
 * set-a-password form (no current-password field, `POST /api/Auth/set-password`) when it does not.
 *
 * **The probe fails SAFE.** `hasExistingPassword` starts true and only ever moves to false on an
 * explicit `data === false`. An older backend answering 404, a dead network, a 401 — anything at
 * all — leaves it true, so the section renders exactly what it rendered before this hook existed,
 * with no error banner. The failure mode that matters is the reverse: offering "set a password" to
 * an account that has one produces a server refusal the user cannot act on.
 */
export interface UseAccountPasswordResult {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  passwordErrors: PasswordFieldErrors;
  passwordSuccess: string;
  passwordStrength: number;
  passwordStrengthText: string;
  /** False ONLY when the server said so. See the fail-safe note above. */
  hasExistingPassword: boolean;
  handleCurrentPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePasswordChangeSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useAccountPassword(): UseAccountPasswordResult {
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({});
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordStrengthText, setPasswordStrengthText] = useState<string>('');
  const [hasExistingPassword, setHasExistingPassword] = useState(true);

  /**
   * The probe, as a function that CANNOT fail: anything other than an explicit boolean answer is
   * reported as `true`. Deliberately silent — no banner, no state the user can see. The section
   * then keeps its change-password behaviour, which is right for every account that has a password
   * and no worse than yesterday for the ones that do not.
   */
  const readHasPassword = useCallback(async (): Promise<boolean> => {
    try {
      const response = await hasPassword();
      // `typeof … === 'boolean'` and not `!response.data`: a body without `data` (an older backend,
      // a proxy that answered something else) must not be read as "this account has no password".
      if (response.success && typeof response.data === 'boolean') return response.data;
    } catch (error) {
      // Bound and logged, never surfaced — the one place in this hook where showing the server's
      // own words would be wrong. Nobody asked for this call, and the form it drives is correct
      // for every account when the probe does not answer, so a banner would report a problem the
      // reader cannot act on. Keeping the error in devtools is what makes an older backend's 404
      // or a CORS failure diagnosable without that cost.
      console.warn('has-password did not answer; assuming this account has a password', error);
    }
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readHasPassword().then((answer) => {
      if (!cancelled) setHasExistingPassword(answer);
    });
    return () => {
      cancelled = true;
    };
  }, [readHasPassword]);

  const clearFieldError = useCallback((field: keyof PasswordFieldErrors) => {
    setPasswordErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
  }, []);

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pass = e.target.value;
    setNewPassword(pass);
    const { strength, text } = checkPasswordStrength(t, pass);
    setPasswordStrength(strength);
    setPasswordStrengthText(text);
    setPasswordSuccess('');
    clearFieldError('newPassword');
    if (pass === confirmNewPassword) clearFieldError('confirmNewPassword');
  };

  const handleCurrentPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.target.value);
    clearFieldError('currentPassword');
    setPasswordSuccess('');
  };

  const handleConfirmNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmNewPassword(e.target.value);
    clearFieldError('confirmNewPassword');
    setPasswordSuccess('');
  };

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordStrength(0);
    setPasswordStrengthText('');
  };

  const submit = async () => {
    if (hasExistingPassword) {
      await changePassword({ currentPassword, newPassword, confirmPassword: confirmNewPassword });
      return;
    }
    const response = await setPassword({ newPassword, confirmPassword: confirmNewPassword });
    // `set-password` goes through `apiClient`, which throws every non-2xx — but a handler refusal
    // (the account already HAS a password) comes back wrapped in `Ok(ApiResponse.Failure(...))`
    // and therefore RESOLVES. Reading `success` is the only thing that catches it.
    if (!response.success) throwServerRefusal(response);
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordErrors({});

    const errors = validatePasswordForm(t, { currentPassword, newPassword, confirmNewPassword }, hasExistingPassword);
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    try {
      await submit();
      setPasswordSuccess(
        hasExistingPassword
          ? t('password_changed_success', 'Password changed successfully!')
          : t('set_password_success', 'Password set. You can now sign in with your email and password.'),
      );
      resetForm();
      // The account has one now, so the next submit must prove it. Without this the form would
      // still be the set-password variant and a second submit would meet the server's refusal.
      //
      // Nothing else to do on success. The server clears the account's stored refresh token here
      // (contract note 2), exactly as `change-password` already does — so the token in this
      // browser is dead and the next 401 will end the session and ask for a sign-in, which is the
      // behaviour the change path has always had. Discarding it eagerly would only bring that
      // moment forward, mid-page, for no gain.
      if (!hasExistingPassword) setHasExistingPassword(true);
    } catch (error) {
      console.error('Failed to save password:', error);
      setPasswordErrors({ form: passwordFailureMessage(t, error, hasExistingPassword) });
      // `PasswordAlreadySet` is the one refusal that changes what the form IS, not just what it
      // says: the account has a password after all (set on another device, or the probe was
      // answered by an older backend), so the set form can never succeed. Switch to the change
      // form at once, then adopt the server's fresh answer — the contract asks for the re-read
      // (`docs/handover/backend-auth-password.md`, suggested client flow step 4).
      if (isPasswordAlreadySet(error)) {
        setHasExistingPassword(true);
        void readHasPassword().then(setHasExistingPassword);
      }
    }
  };

  return {
    currentPassword,
    newPassword,
    confirmNewPassword,
    passwordErrors,
    passwordSuccess,
    passwordStrength,
    passwordStrengthText,
    hasExistingPassword,
    handleCurrentPasswordChange,
    handleNewPasswordChange,
    handleConfirmNewPasswordChange,
    handlePasswordChangeSubmit,
  };
}
