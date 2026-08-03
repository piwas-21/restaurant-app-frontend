'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminTaxConfigurationService, type TaxConfiguration } from '@/services/adminTaxConfigurationService';
import { getErrorMessage } from '@/utils/apiClient';
import { useStableT } from '@/hooks/useStableT';
import type { OrderType } from '@/types/order';

/**
 * The enabled tax rates that apply to one order type, for `TaxSelectionModal` (E9 step 3, slice 7).
 *
 * Extracted for length: giving the failure its own state and its own render pushed the modal past
 * the 200-LOC `*Modal.tsx` limit, and the plan rules out baselining an overflow that is the
 * explanation of a fix. `use[A-Z]*.ts` under `src/**` is gated at 200 too, so nothing hides here.
 *
 * **Why the error is a separate slot rather than an empty list.** The modal renders "No tax
 * configurations available for {{orderType}}" from `length === 0`, which is an ANSWER about the
 * restaurant's configuration. A catch that cleared the list therefore asserted something the
 * server never said — the `usePublicMenuData` shape from #408, where an empty value is read as a
 * fact rather than as a missing one. Callers must suppress the empty state while `error` is set,
 * and must not let a confirm action run off the empty list.
 */
export function useApplicableTaxes(isOpen: boolean, currentOrderType: OrderType) {
  // Through a ref so a language switch cannot re-trigger the fetch; see `useStableT`.
  const tRef = useStableT();
  const [allTaxes, setAllTaxes] = useState<TaxConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * `currentOrderType` is deliberately NOT a dependency, and that is load-bearing rather than an
   * oversight.
   *
   * The request is `getAllTaxConfigurations()` — it takes no order type. Only the FILTER below
   * depends on one. A first version of this hook closed over `currentOrderType` here, which made
   * `load` change identity with it and the effect refetch on every order-type change: work the
   * original `[isOpen]` effect never did, and worse, a race the original could not have. With two
   * loads in flight and the first slower, the second's result was overwritten by the first, so the
   * modal offered a tax that does not apply to the current order type — no error, Confirm enabled.
   *
   * Deriving the filtered list instead of refetching removes the race by construction rather than
   * guarding it: there is only ever one request per open.
   */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAllTaxes(await adminTaxConfigurationService.getAllTaxConfigurations());
    } catch (err) {
      setAllTaxes([]);
      setError(getErrorMessage(err) ?? tRef.current('tax_load_failed', 'Could not load tax rates'));
    } finally {
      setLoading(false);
    }
  }, [tRef]);

  useEffect(() => {
    // `load` reports its own failures into `error`; fire-and-forget.
    if (isOpen) void load();
  }, [isOpen, load]);

  const taxConfigurations = useMemo(
    () => allTaxes.filter((tax) => tax.isEnabled && tax.applicableOrderTypes?.includes(currentOrderType)),
    [allTaxes, currentOrderType],
  );

  return { taxConfigurations, loading, error, reload: load };
}

export default useApplicableTaxes;
