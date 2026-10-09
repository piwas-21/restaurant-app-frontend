'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { OrderType } from '@/types/order';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';

const ALL_ORDER_TYPES = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery] as const;

/**
 * Snapshot and in-flight request shared by every consumer in the current page.
 *
 * The hook now has two simultaneous consumers on /menu and /cart — the order-type picker and the
 * app-wide `useOrderTypeEnabledGuard` — and the service has no cache of its own, so each mount was
 * firing its own identical GET. The shared snapshot also lets an explicit Retry from one surface
 * update the picker, cart, and checkout router together. Each new mount still refreshes the public
 * list, because Dine-In is stripped dynamically at closing time.
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
  publish({ ...snapshot, loading: true });
  inFlight = orderTypeConfigurationService
    .getEnabled()
    .then((result) => {
      const confirmed = Array.isArray(result) && result.length > 0;
      const enabled = confirmed ? result : [...ALL_ORDER_TYPES];
      publish({ enabled, loading: false, confirmed });
      return confirmed ? result : null;
    })
    .catch((error: unknown) => {
      console.error('Error fetching enabled order types:', error);
      publish({ enabled: [...ALL_ORDER_TYPES], loading: false, confirmed: false });
      return null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Fetches the admin-enabled order types on mount. Falls back to all
 * order types on fetch failure OR when the API returns an empty list
 * (e.g. greenfield deployment where the order_type_configurations
 * table hasn't been seeded). An empty configuration is treated as
 * "no preference set" rather than "everything disabled" — the user
 * can still place an order rather than facing a hard wall. An admin
 * who genuinely wants to disable a type must enable the others.
 */
export function useEnabledOrderTypes() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_SNAPSHOT);

  useEffect(() => {
    void refreshEnabledOrderTypes();
  }, []);

  return { ...current, refresh: refreshEnabledOrderTypes };
}
