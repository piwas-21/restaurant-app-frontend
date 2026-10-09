'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import { hasStoredTableGuestState } from '@/services/tableGuestVisitStorage';
import { OrderType } from '@/types/order';
import { useEnabledOrderTypes } from './useEnabledOrderTypes';

type AvailabilityBlockerMessageKey =
  | 'table_guest_dine_in_unavailable'
  | 'table_guest_ended_detail'
  | 'table_guest_storage_help'
  | 'table_guest_unavailable_detail'
  | 'loading';

function getBlockerMessageKey(
  visitBound: boolean,
  active: boolean,
  dineInAvailable: boolean,
  phase: ReturnType<typeof useTableGuestVisit>['phase'],
): AvailabilityBlockerMessageKey | null {
  if (!visitBound) return null;
  if (active) return dineInAvailable ? null : 'table_guest_dine_in_unavailable';
  if (phase === 'ended') return 'table_guest_ended_detail';
  if (phase === 'storageUnavailable') return 'table_guest_storage_help';
  if (phase === 'unavailable') return 'table_guest_unavailable_detail';
  return 'loading';
}

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
  const blockerMessageKey = getBlockerMessageKey(visitBound, active, dineInAvailable, visit.phase);
  const blocked = blockerMessageKey !== null;
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
    blockerMessageKey,
    dineInUnavailable: active && !dineInAvailable,
    dineInAvailable,
    refreshDineInAvailability,
  } as const;
}
