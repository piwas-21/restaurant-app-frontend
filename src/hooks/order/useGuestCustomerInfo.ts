'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserDto } from '@/types/user';
import { useCheckout } from '@/contexts/CheckoutContext';
import { getCurrentUser } from '@/services/userService';
import {
  validateGuestCustomerInfoField,
  type CustomerInfoField,
  type GuestCustomerInfoErrors,
  type GuestCustomerInfoValue,
} from '@/components/order/GuestCustomerInfoFields';

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
  /** Validate every required field; returns the trimmed values when valid, null otherwise. */
  commit: () => GuestCustomerInfoValue | null;
}

const EMPTY_ERRORS: GuestCustomerInfoErrors = { name: '', email: '', phone: '' };

/**
 * Drives the inline customer-info inputs for the order-type modals
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.e). Pre-fills from server profile (when
 * logged in) or the legacy `rumi_saved_customer_info` localStorage key
 * (so a returning guest doesn't have to re-type), then narrows the
 * visible fields to whatever profile values are missing — logged-in
 * users with everything on file see no inputs at all (`visibleFields = []`).
 *
 * `commit()` validates every required field and writes the trimmed
 * customer info to `CheckoutContext.customerInfo` only when valid;
 * smart-skip downstream picks it up from there.
 */
export function useGuestCustomerInfo(opts: UseGuestCustomerInfoOptions): UseGuestCustomerInfoResult {
  const { t } = useTranslation();
  const { state: checkoutState, setCustomerInfo } = useCheckout();

  const [value, setValue] = useState<GuestCustomerInfoValue>(() => ({
    name: checkoutState.customerInfo?.name ?? '',
    email: checkoutState.customerInfo?.email ?? '',
    phone: checkoutState.customerInfo?.phone ?? '',
  }));
  const [errors, setErrors] = useState<GuestCustomerInfoErrors>(EMPTY_ERRORS);
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Resolve the auth + profile state once the modal opens. Cancellable so a
  // close-then-reopen race doesn't write stale state into a remounted hook.
  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;
    (async () => {
      setIsLoadingUser(true);
      try {
        if (typeof window === 'undefined') return;
        const authToken = localStorage.getItem('auth_token');
        if (authToken) {
          try {
            const u = await getCurrentUser();
            if (cancelled) return;
            setUser(u);
            setIsLoggedIn(true);
            setValue((prev) => ({
              name: prev.name || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}`.trim() : u.email),
              email: prev.email || u.email || '',
              phone: prev.phone || u.phoneNumber || '',
            }));
            return;
          } catch (err) {
            console.warn('Profile fetch failed; treating as guest:', err);
          }
        }
        if (cancelled) return;
        setIsLoggedIn(false);
        const saved = localStorage.getItem(SAVED_INFO_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as Partial<GuestCustomerInfoValue>;
            setValue((prev) => ({
              name: prev.name || parsed.name || '',
              email: prev.email || parsed.email || '',
              phone: prev.phone || parsed.phone || '',
            }));
          } catch {
            // Corrupted saved info — fall through with current state.
          }
        }
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts.enabled]);

  const phoneRequired = opts.requiredFields.includes('phone');

  // Visible = required AND not already pre-filled from profile.
  const visibleFields = useMemo<ReadonlyArray<CustomerInfoField>>(() => {
    return opts.requiredFields.filter((f) => {
      const filled = !!user && hasProfileValue(user, f);
      return !filled;
    });
  }, [opts.requiredFields, user]);

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

  const commit = useCallback((): GuestCustomerInfoValue | null => {
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
    setCustomerInfo(trimmed);
    if (!isLoggedIn && typeof window !== 'undefined') {
      try {
        localStorage.setItem(SAVED_INFO_KEY, JSON.stringify(trimmed));
      } catch {
        // localStorage full / blocked — non-critical, the order still proceeds.
      }
    }
    return trimmed;
  }, [opts.requiredFields, value, t, phoneRequired, setCustomerInfo, isLoggedIn]);

  return {
    value,
    errors,
    visibleFields,
    showRegisterCta: !isLoggedIn,
    isLoadingUser,
    setField,
    blurField,
    commit,
  };
}

function hasProfileValue(user: UserDto, field: CustomerInfoField): boolean {
  if (field === 'name') return !!(user.firstName?.trim() && user.lastName?.trim());
  if (field === 'email') return !!user.email?.trim();
  if (field === 'phone') return !!user.phoneNumber?.trim();
  return false;
}
