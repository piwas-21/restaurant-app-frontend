'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { OrderType } from '@/types/order';
import { isUuid } from '@/utils/uuid';
import { parseTableNumber } from './newSaleRequest';
import type { NewSaleDraftState } from './useNewSaleDraft';

/** Apply Add round's table link once, without moving an unfinished ticket to another visit. */
export function useNewSaleEntry(
  enabled: readonly OrderType[],
  channelsLoading: boolean,
  hydrated: boolean,
  state: NewSaleDraftState,
  setState: Dispatch<SetStateAction<NewSaleDraftState>>,
) {
  const [entryConflict, setEntryConflict] = useState(false);
  const appliedEntryParamsRef = useRef(false);

  useEffect(() => {
    if (!hydrated || channelsLoading || appliedEntryParamsRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    const tableId = params.get('tableId');
    const serviceSessionId = params.get('serviceSessionId');
    const hasPinnedVisit = Boolean(serviceSessionId?.trim());
    const label = tableParam?.trim() ?? '';
    if (params.get('channel') !== 'DineIn' || (!hasPinnedVisit && tableParam === null)) return;
    const stableTableId = isUuid(tableId) ? tableId : undefined;
    if ((!hasPinnedVisit && parseTableNumber(label) === null) || !enabled.includes(OrderType.DineIn)) return;
    appliedEntryParamsRef.current = true;

    const sameVisitIdentity = hasPinnedVisit
      ? state.serviceSessionId === serviceSessionId && (!stableTableId || state.tableId === stableTableId)
      : state.serviceSessionId === undefined && state.tableId === undefined;
    const sameVisit =
      state.channel === OrderType.DineIn &&
      state.tableNumber.trim().toLocaleLowerCase() === label.toLocaleLowerCase() &&
      sameVisitIdentity;
    const hasUnsentContent = state.lines.length > 0 || state.notes.trim() !== '' || state.contact !== undefined;
    if (hasUnsentContent && !sameVisit) {
      setEntryConflict(true);
      return;
    }
    setState((current) => ({
      ...current,
      channel: OrderType.DineIn,
      tableNumber: label,
      tableId: stableTableId ?? (sameVisit ? current.tableId : undefined),
      serviceSessionId: hasPinnedVisit ? serviceSessionId?.trim() : undefined,
      clientOperationId: sameVisit ? current.clientOperationId : undefined,
    }));
  }, [hydrated, channelsLoading, enabled, state, setState]);

  const clearEntryConflict = useCallback(() => setEntryConflict(false), []);
  return { entryConflict, clearEntryConflict };
}
