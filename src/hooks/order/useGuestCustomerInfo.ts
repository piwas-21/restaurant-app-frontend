'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckout } from '@/contexts/CheckoutContext';
import { persistPhoneToProfileIfChanged } from '@/lib/checkout/persistPhoneToProfile';
import {
  validateGuestCustomerInfoField,
  type CustomerInfoField,
  type GuestCustomerInfoErrors,
  type GuestCustomerInfoValue,
  type RegisterField,
  type RegisterFieldsErrors,
  type RegisterFieldsValue,
} from '@/components/order/GuestCustomerInfoFields';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { useInlineRegistration } from './useInlineRegistration';
import { useGuestProfilePrefill } from './useGuestProfilePrefill';

const SAVED_INFO_KEY = 'rumi_saved_customer_info';

export interface UseGuestCustomerInfoOptions {
  /**
   * Required fields for the active flow:
   *   - DineIn:   ['name', 'email']  (phone optional, matches existing
   *               customer-info schema)
   *   - Takeaway: ['name', 'email', 'phone']
   *   - Delivery: ['name', 'email', 'phone']
   */
  requiredFields: ReadonlyArray<CustomerInfoField>;
  /**
   * Mount-gating: pass `true` only when the modal is open. Until then
   * the user-fetch and saved-info read are deferred so closed modals
   * don't fire `/api/User/profile` on every page render.
   */
  enabled: boolean;
  /** Analytics tag for `customer_info_submitted` — see analytics.ts. */
  source?: string;
}

interface UseGuestCustomerInfoResult {
  value: GuestCustomerInfoValue;
  errors: GuestCustomerInfoErrors;
  /** Visible fields — what isn't pre-filled by the user's profile. */
  visibleFields: ReadonlyArray<CustomerInfoField>;
  /** Logged-in users have an account; suppress the register CTA for them. */
  showRegisterCta: boolean;
  /** True while we're still fetching the profile to decide what to render. */
  isLoadingUser: boolean;
  setField: (field: CustomerInfoField, next: string) => void;
  blurField: (field: CustomerInfoField) => void;

  /** Inline-registration state (§C1.5.g) — re-exposed from `useInlineRegistration`. */
  wantsRegister: boolean;
  setWantsRegister: (next: boolean) => void;
  registerValue: RegisterFieldsValue;
  registerErrors: RegisterFieldsErrors;
  setRegisterField: (field: RegisterField, next: string) => void;
  blurRegisterField: (field: RegisterField) => void;
  isRegistering: boolean;

  /**
   * Validate every required field; if `wantsRegister`, also validate
   * passwords AND fire the register-customer call. Returns the trimmed
   * customer-info values when ready to proceed; null when validation
   * fails or registration fails with an inline-recoverable error
   * (caller should keep modal open so the user can adjust).
   */
  commit: () => Promise<GuestCustomerInfoValue | null>;
}

const EMPTY_ERRORS: GuestCustomerInfoErrors = { name: '', email: '', phone: '' };

/**
 * Drives the inline customer-info inputs for the order-type modals
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.e + §C1.5.g). Pre-fills from profile
 * (logged-in) or `rumi_saved_customer_info` (returning guest), narrows
 * visible fields to what's missing, and `commit()`s trimmed values to
 * `CheckoutContext.customerInfo` only when valid. Inline registration
 * is composed from `useInlineRegistration` via `registerIfRequested()`.
 */
export function useGuestCustomerInfo(opts: UseGuestCustomerInfoOptions): UseGuestCustomerInfoResult {
  const { t } = useTranslation();
  const { state: checkoutState, setCustomerInfo } = useCheckout();
  const registration = useInlineRegistration();
  const { user, isLoggedIn, isLoadingUser, prefill, visibleFields } = useGuestProfilePrefill(
    opts.enabled,
    opts.requiredFields,
  );

  const [value, setValue] = useState<GuestCustomerInfoValue>(() => ({
    name: checkoutState.customerInfo?.name ?? '',
    email: checkoutState.customerInfo?.email ?? '',
    phone: checkoutState.customerInfo?.phone ?? '',
  }));
  const [errors, setErrors] = useState<GuestCustomerInfoErrors>(EMPTY_ERRORS);

  // Merge prefill once it lands; user-typed values take precedence.
  useEffect(() => {
    if (isLoadingUser) return;
    setValue((prev) => ({
      name: prev.name || prefill.name,
      email: prev.email || prefill.email,
      phone: prev.phone || prefill.phone,
    }));
  }, [isLoadingUser, prefill]);

  const phoneRequired = opts.requiredFields.includes('phone');

  const setField = useCallback((field: CustomerInfoField, next: string) => {
    setValue((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  }, []);

  const blurField = useCallback(
    (field: CustomerInfoField) => {
      const err = validateGuestCustomerInfoField(field, value[field], t, { phoneRequired });
      setErrors((prev) => ({ ...prev, [field]: err }));
    },
    [value, t, phoneRequired],
  );

  const commit = useCallback(async (): Promise<GuestCustomerInfoValue | null> => {
    const next: GuestCustomerInfoErrors = { name: '', email: '', phone: '' };
    let ok = true;
    for (const field of opts.requiredFields) {
      const err = validateGuestCustomerInfoField(field, value[field], t, { phoneRequired });
      next[field] = err;
      if (err) ok = false;
    }
    setErrors(next);
    if (!ok) return null;

    const trimmed: GuestCustomerInfoValue = {
      name: value.name.trim(),
      email: value.email.trim(),
      phone: value.phone.trim(),
    };

    const outcome = await registration.registerIfRequested({ name: trimmed.name, email: trimmed.email });
    if (outcome.status === 'invalid') {
      // Sub-hook already populated registerErrors; ensure the name field
      // shows guidance when split-name validation fails (single-token name).
      setErrors((prev) => ({
        ...prev,
        name:
          prev.name ||
          (trimmed.name.split(' ').filter(Boolean).length < 2
            ? t('register_full_name_help', 'Please enter your full name (first and last)')
            : prev.name),
      }));
      return null;
    }
    if (outcome.status === 'duplicate') {
      setErrors((prev) => ({
        ...prev,
        email: t('email_already_registered', 'An account with this email already exists. Please log in.'),
      }));
      return null;
    }

    setCustomerInfo(trimmed);
    // Funnel event — user-action path inside commit(), not an effect, so
    // it can't double-fire on re-render.
    trackEvent('customer_info_submitted', {
      source: opts.source,
      fields: opts.requiredFields,
      loggedIn: isLoggedInForAnalytics(),
    });
    if (!isLoggedIn && typeof window !== 'undefined') {
      try {
        localStorage.setItem(SAVED_INFO_KEY, JSON.stringify(trimmed));
      } catch {
        // localStorage full / blocked — non-critical.
      }
    }

    persistPhoneToProfileIfChanged({ isLoggedIn, user, newPhone: trimmed.phone });

    return trimmed;
  }, [opts.requiredFields, opts.source, value, t, phoneRequired, registration, setCustomerInfo, isLoggedIn, user]);

  return {
    value,
    errors,
    visibleFields,
    showRegisterCta: !isLoggedIn,
    isLoadingUser,
    setField,
    blurField,
    wantsRegister: registration.wantsRegister,
    setWantsRegister: registration.setWantsRegister,
    registerValue: registration.registerValue,
    registerErrors: registration.registerErrors,
    setRegisterField: registration.setRegisterField,
    blurRegisterField: registration.blurRegisterField,
    isRegistering: registration.isRegistering,
    commit,
  };
}
