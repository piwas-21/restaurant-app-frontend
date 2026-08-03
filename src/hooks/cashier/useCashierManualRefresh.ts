'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ManualRefreshReporter {
  showSuccess: (message: string) => void;
}

/**
 * The cashier header's Refresh button: the pending flag, and the one thing it must get right —
 * NOT announcing success when the refresh failed.
 *
 * It could not tell before (E9 slice 8). `refreshOrders` resolves on BOTH paths — it captures the
 * failure into the `error` banner and never rejects — so the page awaited it, announced "Orders
 * refreshed" unconditionally, and put that success toast on top of the error banner every time the
 * backend was down. The `catch` written for that case was unreachable. The boolean `refreshOrders`
 * now returns is the only signal that distinguishes them.
 *
 * **Nothing is reported on the failure path, deliberately.** `refreshOrders` has already written
 * the SERVER's own sentence into `error`, which the page renders as an alert. Adding a generic
 * "Failed to refresh orders" beside it stacks a claim next to a reason — a milder version of the
 * same defect this hook exists to remove, and the shape E9 is sweeping out. Staying silent here is
 * what makes the boolean's job "suppress the false success" rather than "report twice".
 *
 * `try/finally` with no `catch`: nothing here can reject today, but that guarantee lives in another
 * file now, and a rejection would leave the button disabled for the rest of the shift.
 */
export function useCashierManualRefresh(refreshOrders: () => Promise<boolean>, reporter: ManualRefreshReporter) {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    let refreshed = false;
    try {
      refreshed = await refreshOrders();
    } finally {
      setIsRefreshing(false);
    }
    if (refreshed) reporter.showSuccess(t('cashier.orders_refreshed'));
  }, [refreshOrders, reporter, t]);

  return { isRefreshing, handleRefresh };
}

export default useCashierManualRefresh;
