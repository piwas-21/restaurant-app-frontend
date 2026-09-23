'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OrderType } from '@/types/order';
import { addCustomizedItem } from '@/components/catalog/orderItems';
import type { CustomizationResult } from '@/components/catalog/productCustomizationTypes';
import type { Product } from '@/services/serverService';
import {
  clearCashierNewSaleDraft,
  persistCashierNewSaleDraft,
  readCashierNewSaleDraft,
  type CashierNewSaleDraftLine,
} from '@/lib/cashierNewSaleDraft';
import type { CashierNewSaleContact } from '@/lib/cashierNewSaleContact';
import { defaultChannelFor, parseTableNumber } from './newSaleRequest';

/**
 * The one persistent New sale draft (plan §5.3.7): its state lives in sessionStorage and
 * survives navigation between the workspace destinations. Every content change drops the
 * stored create operation key and the quoted price — the next review quotes the new ticket
 * and creates it under a fresh key, never replaying a changed payload under an old one.
 */
export interface NewSaleDraftState {
  channel: OrderType | null;
  lines: CashierNewSaleDraftLine[];
  notes: string;
  tableNumber: string;
  contact?: CashierNewSaleContact;
  clientOperationId?: string;
}

export const EMPTY_NEW_SALE_STATE: NewSaleDraftState = { channel: null, lines: [], notes: '', tableNumber: '' };

export function useNewSaleDraft(enabled: readonly OrderType[], channelsLoading: boolean) {
  const [state, setState] = useState<NewSaleDraftState>(EMPTY_NEW_SALE_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<{ line: CashierNewSaleDraftLine; index: number } | null>(null);
  // `?channel=DineIn&table=N` (Add round on the Tables screen) is applied exactly once per mount.
  const appliedEntryParamsRef = useRef(false);

  // Restore the draft after a navigation; a foreign version reads as none and starts empty.
  useEffect(() => {
    const stored = readCashierNewSaleDraft();
    if (stored) {
      setState({
        channel: stored.channel,
        lines: stored.lines,
        notes: stored.notes ?? '',
        tableNumber: stored.tableNumber ? String(stored.tableNumber) : '',
        contact: stored.contact,
        clientOperationId: stored.clientOperationId,
      });
    }
    setHydrated(true);
  }, []);

  // The channel is the tenant's valid default, never a guess: until the enabled list answers
  // the picker waits, and a restored channel the tenant no longer offers falls back to it.
  useEffect(() => {
    if (!hydrated || channelsLoading) return;
    setState((current) =>
      current.channel !== null && enabled.includes(current.channel)
        ? current
        : { ...current, channel: defaultChannelFor(enabled) },
    );
  }, [hydrated, channelsLoading, enabled]);

  // Entry deep link (Add round): preselect the channel and its table ONCE after hydration and
  // the enabled-channel list answer, so neither effect can clobber it. A channel the tenant no
  // longer offers is ignored rather than bounced later.
  useEffect(() => {
    if (!hydrated || channelsLoading || appliedEntryParamsRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    const channelParam = params.get('channel');
    if (channelParam !== 'DineIn' || tableParam === null) return;
    const table = parseTableNumber(tableParam);
    if (table === null || !enabled.includes(OrderType.DineIn)) return;
    appliedEntryParamsRef.current = true;
    setState((current) => ({ ...current, channel: OrderType.DineIn, tableNumber: String(table) }));
  }, [hydrated, channelsLoading, enabled]);

  // Persist the moving draft; an emptied ticket clears the stored one instead of leaving a ghost.
  useEffect(() => {
    if (!hydrated) return;
    const hasContent = state.channel !== null && (state.lines.length > 0 || state.notes.trim() !== '');
    if (!hasContent || state.channel === null) {
      clearCashierNewSaleDraft();
      return;
    }
    const channel = state.channel;
    const tableNumber = parseTableNumber(state.tableNumber);
    persistCashierNewSaleDraft({
      channel,
      lines: state.lines,
      notes: state.notes,
      tableNumber: state.channel === OrderType.DineIn ? (tableNumber ?? undefined) : undefined,
      contact: state.contact,
      clientOperationId: state.clientOperationId,
    });
  }, [state, hydrated]);

  const mutate = useCallback((next: (current: NewSaleDraftState) => NewSaleDraftState) => {
    // Deliberately does NOT touch `lastRemoved`: an undo stays available across further edits
    // until it is used, replaced by a newer removal, or the ticket is emptied for good.
    setState((current) => ({ ...next(current), clientOperationId: undefined }));
  }, []);

  /** Empty the ticket — used once its order is committed, so the persist effect clears the
   * stored draft instead of resurrecting it on the next state write. */
  const reset = useCallback(() => {
    setLastRemoved(null);
    setState(EMPTY_NEW_SALE_STATE);
  }, []);

  /** Record the create operation id this ticket is being submitted under. Not a content change:
   * it must not drop the quoted price, and a later mutation still removes it. */
  const setOperationId = useCallback((clientOperationId: string) => {
    setState((current) => ({ ...current, clientOperationId }));
  }, []);

  const setChannel = useCallback((channel: OrderType) => mutate((current) => ({ ...current, channel })), [mutate]);
  const setNotes = useCallback((notes: string) => mutate((current) => ({ ...current, notes })), [mutate]);
  const setTableNumber = useCallback(
    (tableNumber: string) => mutate((current) => ({ ...current, tableNumber })),
    [mutate],
  );
  const setContact = useCallback(
    (contact: CashierNewSaleContact | undefined) => mutate((current) => ({ ...current, contact })),
    [mutate],
  );

  const addLine = useCallback(
    (product: Pick<Product, 'id' | 'name'>, result: CustomizationResult) =>
      mutate((current) => ({ ...current, lines: addCustomizedItem(current.lines, product, result) })),
    [mutate],
  );

  const setLineQuantity = useCallback(
    (index: number, quantity: number) =>
      mutate((current) => ({
        ...current,
        lines:
          quantity <= 0
            ? current.lines.filter((_, lineIndex) => lineIndex !== index)
            : current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, quantity } : line)),
      })),
    [mutate],
  );

  const removeLine = useCallback(
    (index: number) => {
      setLastRemoved({ line: state.lines[index], index });
      mutate((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }));
    },
    [mutate, state.lines],
  );

  /** Restore the most recent removal at its old position; only works while the line is unsent. */
  const undoRemove = useCallback(() => {
    const removal = lastRemoved;
    if (removal?.line === undefined) return;
    setLastRemoved(null);
    setState((current) => {
      const lines = [...current.lines];
      lines.splice(Math.min(removal.index, lines.length), 0, removal.line);
      return { ...current, lines, clientOperationId: undefined };
    });
  }, [lastRemoved]);

  return {
    state,
    hydrated,
    lastRemoved,
    setChannel,
    setNotes,
    setTableNumber,
    setContact,
    addLine,
    reset,
    setOperationId,
    setLineQuantity,
    removeLine,
    undoRemove,
  };
}
