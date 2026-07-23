'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UserDto } from '@/types/user';
import { getCurrentUser } from '@/services/userService';
import type { CustomerInfoField, GuestCustomerInfoValue } from '@/components/order/GuestCustomerInfoFields';

const SAVED_INFO_KEY = 'rumi_saved_customer_info';

export interface UseGuestProfilePrefillResult {
  /** The resolved logged-in user, or null for guests / pre-resolution. */
  user: UserDto | null;
  isLoggedIn: boolean;
  isLoadingUser: boolean;
  /**
   * Initial form values to seed into the parent hook's state on mount —
   * filled from /api/User/profile (logged-in) or the legacy
   * `rumi_saved_customer_info` localStorage key (returning guest).
   * Empty `{name:'', email:'', phone:''}` until the effect resolves.
   */
  prefill: GuestCustomerInfoValue;
  /**
   * Fields the form should still render — anything in the collected set
   * that isn't pre-filled from the user's server profile. Logged-in
   * users with a complete profile see no fields at all.
   */
  visibleFields: ReadonlyArray<CustomerInfoField>;
}

/**
 * Resolves auth + profile state once the modal opens, then exposes
 * `prefill` and `visibleFields` derived from the resolved user.
 * `fields` is the merged shown set (order-type floor + admin config —
 * see `mergeContactFieldRules`); the narrowing composes on top of it.
 * Cancellable so a close-then-reopen race doesn't write stale state
 * into a remounted hook. Extracted from `useGuestCustomerInfo` to keep
 * each hook under the §4 LOC limit.
 */
export function useGuestProfilePrefill(
  enabled: boolean,
  fields: ReadonlyArray<CustomerInfoField>,
): UseGuestProfilePrefillResult {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [prefill, setPrefill] = useState<GuestCustomerInfoValue>({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!enabled) return;
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
            setPrefill({
              name: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}`.trim() : u.email || '',
              email: u.email || '',
              phone: u.phoneNumber || '',
            });
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
            setPrefill({
              name: parsed.name || '',
              email: parsed.email || '',
              phone: parsed.phone || '',
            });
          } catch {
            // Corrupted saved info — fall through with empty prefill.
          }
        }
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const visibleFields = useMemo<ReadonlyArray<CustomerInfoField>>(() => {
    return fields.filter((f) => !(user && hasProfileValue(user, f)));
  }, [fields, user]);

  return { user, isLoggedIn, isLoadingUser, prefill, visibleFields };
}

function hasProfileValue(user: UserDto, field: CustomerInfoField): boolean {
  if (field === 'name') return !!(user.firstName?.trim() && user.lastName?.trim());
  if (field === 'email') return !!user.email?.trim();
  if (field === 'phone') return !!user.phoneNumber?.trim();
  return false;
}
