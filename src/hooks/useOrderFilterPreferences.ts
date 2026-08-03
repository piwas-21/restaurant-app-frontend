import { useState, useEffect } from 'react';
import { OrderStatus } from '@/types/order';
import { ORDER_PAYMENT_STATUSES } from '@/lib/paymentStatus';

/** The order payment statuses a filter may hold — the real ones, plus the "no filter" sentinel. */
export type OrderPaymentStatusFilter = (typeof ORDER_PAYMENT_STATUSES)[number] | 'All';

interface OrderFilterPreferences {
  selectedStatus: OrderStatus | 'All';
  selectedPaymentStatus: OrderPaymentStatusFilter;
  selectedOrderType: string;
  showFocusOnly: boolean;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

const STORAGE_KEY = 'admin-orders-filter-preferences';

const DEFAULT_PREFERENCES: OrderFilterPreferences = {
  selectedStatus: 'All',
  selectedPaymentStatus: 'All',
  selectedOrderType: 'All',
  showFocusOnly: false,
  sortBy: 'date',
  sortOrder: 'desc',
};

/**
 * Drop a persisted payment-status filter the app can no longer honour.
 *
 * localStorage outlives a deploy, and this value goes STRAIGHT TO THE SERVER as a query filter. An
 * admin who left the filter on `'Paid'` — a value the backend has no enum member for — would keep
 * sending it after this release: the server's `Enum.TryParse` fails, the whole `Where` clause is
 * skipped, and they get EVERY order while the dropdown shows blank, because `Paid` is no longer one
 * of its options. Restoring state from storage without re-validating it is how a fixed contract
 * un-fixes itself for exactly the users who had the broken one.
 */
function clampPaymentStatus(parsed: Partial<OrderFilterPreferences>): Partial<OrderFilterPreferences> {
  const value = parsed.selectedPaymentStatus;
  if (value === 'All' || (value && (ORDER_PAYMENT_STATUSES as readonly string[]).includes(value))) return {};
  return { selectedPaymentStatus: 'All' };
}

/**
 * Custom hook to manage order filter preferences with localStorage persistence
 */
export function useOrderFilterPreferences() {
  const [preferences, setPreferences] = useState<OrderFilterPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OrderFilterPreferences;
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed, ...clampPaymentStatus(parsed) });
      }
    } catch {
      // IGNORED ON PURPOSE. What throws here is `localStorage` being unavailable (Safari private
      // browsing, storage disabled by policy) or `JSON.parse` on a corrupt value — and in both
      // cases `DEFAULT_PREFERENCES` is already in state, so the admin gets the unfiltered order
      // list, which is the right screen and the one they see on a first visit anyway. Nothing is
      // lost but a convenience; there is no server call behind this and no data at risk. Note the
      // spread above is deliberately defensive for the same reason: a stored value that parses is
      // still merged over the defaults and its payment status clamped, because a value that parses
      // is not thereby a value we wrote.
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  const savePreferences = (newPreferences: Partial<OrderFilterPreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // IGNORED ON PURPOSE. `setPreferences(updated)` has already run, so the filter just chosen IS
      // applied — only its persistence across a reload failed (quota exceeded, or storage
      // unavailable). Reporting that would interrupt a working action to announce that a
      // convenience did not stick, and there is no retry to offer.
    }
  };

  // Clear all preferences
  const clearPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // IGNORED ON PURPOSE, and this one is the most clearly safe of the three: the in-memory reset
      // above has already happened, so the admin sees the cleared filters. A `removeItem` that
      // throws did so because storage is unavailable — which means there is nothing stored to
      // leak back on the next load either.
    }
  };

  return {
    preferences,
    isLoaded,
    savePreferences,
    clearPreferences,
  };
}
