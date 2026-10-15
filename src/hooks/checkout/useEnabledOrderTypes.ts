'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { OrderType } from '@/types/order';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';

/**
 * Snapshot and in-flight request shared by every consumer in the current page.
 *
 * The order-type picker and app-wide guard share reads and explicit retries. A refresh invalidates
 * the old snapshot until the server responds; both a confirmed empty list and an unverified read
 * expose no selectable channels.
 */
interface EnabledOrderTypesSnapshot {
  readonly enabled: OrderType[];
  readonly loading: boolean;
  readonly confirmed: boolean;
}

const INITIAL_SNAPSHOT: EnabledOrderTypesSnapshot = { enabled: [], loading: true, confirmed: false };
let snapshot = INITIAL_SNAPSHOT;
let inFlight: Promise<OrderType[] | null> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): EnabledOrderTypesSnapshot {
  return snapshot;
}

function publish(next: EnabledOrderTypesSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function refreshEnabledOrderTypes(): Promise<OrderType[] | null> {
  if (inFlight) return inFlight;
  // A previous positive snapshot is stale once a new read starts. Keep no channel selectable
  // until this refresh confirms the current server availability.
  publish({ ...snapshot, loading: true, confirmed: false });
  inFlight = orderTypeConfigurationService
    .getEnabled()
    .then((result) => {
      // An empty successful list is authoritative: the restaurant currently offers no public
      // channels (including when hours enforcement closes every channel). Failed reads remain
      // unavailable until retry; backend writes remain the final authority either way.
      const confirmed = Array.isArray(result);
      const enabled = confirmed ? result : [];
      publish({ enabled, loading: false, confirmed });
      return confirmed ? result : null;
    })
    .catch((error: unknown) => {
      console.error('Error fetching enabled order types:', error);
      publish({ enabled: [], loading: false, confirmed: false });
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Fetches the server's public availability list on mount. A successful empty list is closed or
 * disabled, and any transport failure is unknown: neither state exposes a checkout path. Order
 * creation still uses the backend guard as the final authority.
 */
export function useEnabledOrderTypes({ refreshOnMount = true }: { refreshOnMount?: boolean } = {}) {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_SNAPSHOT);

  useEffect(() => {
    if (refreshOnMount) void refreshEnabledOrderTypes();
  }, [refreshOnMount]);

  return { ...current, refresh: refreshEnabledOrderTypes };
}
