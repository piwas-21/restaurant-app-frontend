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
    if (params.get('channel') !== 'DineIn' || tableParam === null) return;
    const linked = isUuid(tableId) && isUuid(serviceSessionId) && tableParam.trim().length > 0;
    if ((!linked && parseTableNumber(tableParam) === null) || !enabled.includes(OrderType.DineIn)) return;
    appliedEntryParamsRef.current = true;

    const sameVisit =
      state.channel === OrderType.DineIn &&
      state.tableNumber.trim().toLocaleLowerCase() === tableParam.trim().toLocaleLowerCase() &&
      state.tableId === (linked ? tableId : undefined) &&
      state.serviceSessionId === (linked ? serviceSessionId : undefined);
    const hasUnsentContent = state.lines.length > 0 || state.notes.trim() !== '' || state.contact !== undefined;
    if (hasUnsentContent && !sameVisit) {
      setEntryConflict(true);
      return;
    }
    setState((current) => ({
      ...current,
      channel: OrderType.DineIn,
      tableNumber: tableParam.trim(),
      tableId: linked ? tableId : undefined,
      serviceSessionId: linked ? serviceSessionId : undefined,
      clientOperationId: sameVisit ? current.clientOperationId : undefined,
    }));
  }, [hydrated, channelsLoading, enabled, state, setState]);

  const clearEntryConflict = useCallback(() => setEntryConflict(false), []);
  return { entryConflict, clearEntryConflict };
}
