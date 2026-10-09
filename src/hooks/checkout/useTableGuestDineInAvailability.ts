'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { hasStoredTableGuestState } from '@/services/tableGuestVisitStorage';
import { OrderType } from '@/types/order';
import { useEnabledOrderTypes } from './useEnabledOrderTypes';

/**
 * The active table visit is bound to Dine-In. Unlike ordinary browsing, it must not fall back to
 * another order type when the public enabled-type read is pending, empty, or unavailable.
 */
export function useTableGuestDineInAvailability() {
  const visit = useTableGuestVisit();
  const { enabled, loading, confirmed, refresh } = useEnabledOrderTypes();
  const hasStoredState = hasStoredTableGuestState();
  const visitBound = visit.phase === 'active' || (hasStoredState && visit.phase !== 'notJoined');
  const active = visit.phase === 'active';
  const activeVisitId = active ? (visit.visit?.serviceSessionId ?? null) : null;
  const [verifiedVisitId, setVerifiedVisitId] = useState<string | null>(null);
  const availabilityVerified = activeVisitId !== null && verifiedVisitId === activeVisitId;
  const dineInAvailable =
    !loading && confirmed && enabled.includes(OrderType.DineIn) && (!active || availabilityVerified);
  const blocked = visitBound && (!active || !dineInAvailable);
  const refreshDineInAvailability = useCallback(async () => {
    const current = await refresh();
    if (activeVisitId) setVerifiedVisitId(activeVisitId);
    return current?.includes(OrderType.DineIn) ?? false;
  }, [activeVisitId, refresh]);

  // A visit can remain open while staff changes opening hours. Recheck the public configuration
  // when the guest enters the active state and when they return to this tab, so Dine-In is restored
  // only after the server advertises it. The shared store deduplicates this with other consumers.
  useEffect(() => {
    if (!activeVisitId) {
      setVerifiedVisitId(null);
      return;
    }
    let current = true;
    void refreshDineInAvailability().then(() => {
      if (current) setVerifiedVisitId(activeVisitId);
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshDineInAvailability();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      current = false;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [activeVisitId, refreshDineInAvailability]);

  return {
    phase: visit.phase,
    visit: visit.visit,
    visitBound,
    active,
    blocked,
    dineInUnavailable: active && !dineInAvailable,
    dineInAvailable,
    refreshDineInAvailability,
  } as const;
}
