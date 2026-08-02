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
      // Failed to load preferences, use defaults
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
      // Failed to save, continue without persistence
    }
  };

  // Clear all preferences
  const clearPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Failed to clear, continue
    }
  };

  return {
    preferences,
    isLoaded,
    savePreferences,
    clearPreferences,
  };
}
