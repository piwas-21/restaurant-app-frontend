'use client';

import { useEffect, useState } from 'react';
import { useOptionalAuth } from '@/components/AuthContext';

/**
 * True only for a signed-in admin, and only after mount. Auth resolves
 * client-side, so gating on the first paint would either flash the control or
 * mismatch SSR. Shared by the admin quick-edit affordances on a menu card
 * (`AdminMenuCardControls`, `AdminPriceEditor`) so the two can't drift apart.
 */
export function useIsAdmin(): boolean {
  const auth = useOptionalAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || auth?.isLoading) return false;
  return auth?.user?.role?.toLowerCase() === 'admin';
}
