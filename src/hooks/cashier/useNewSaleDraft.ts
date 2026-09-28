'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { useNewSaleEntry } from './useNewSaleEntry';

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
  tableId?: string;
  serviceSessionId?: string;
  contact?: CashierNewSaleContact;
  clientOperationId?: string;
}

export const EMPTY_NEW_SALE_STATE: NewSaleDraftState = { channel: null, lines: [], notes: '', tableNumber: '' };

export function useNewSaleDraft(enabled: readonly OrderType[], channelsLoading: boolean) {
  const [state, setState] = useState<NewSaleDraftState>(EMPTY_NEW_SALE_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<{ line: CashierNewSaleDraftLine; index: number } | null>(null);
  const { entryConflict, clearEntryConflict } = useNewSaleEntry(enabled, channelsLoading, hydrated, state, setState);

  // Restore the draft after a navigation; a foreign version reads as none and starts empty.
  useEffect(() => {
    const stored = readCashierNewSaleDraft();
    if (stored) {
      setState({
        channel: stored.channel,
        lines: stored.lines,
        notes: stored.notes ?? '',
        tableNumber: stored.tableLabel ?? (stored.tableNumber ? String(stored.tableNumber) : ''),
        tableId: stored.tableId,
        serviceSessionId: stored.serviceSessionId,
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
      tableLabel: state.channel === OrderType.DineIn ? state.tableNumber.trim() || undefined : undefined,
      tableId: state.channel === OrderType.DineIn ? state.tableId : undefined,
      serviceSessionId: state.channel === OrderType.DineIn ? state.serviceSessionId : undefined,
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
    clearEntryConflict();
    setState(EMPTY_NEW_SALE_STATE);
  }, [clearEntryConflict]);

  /** Record the create operation id this ticket is being submitted under. Not a content change:
   * it must not drop the quoted price, and a later mutation still removes it. */
  const setOperationId = useCallback((clientOperationId: string) => {
    setState((current) => ({ ...current, clientOperationId }));
  }, []);

  const setChannel = useCallback(
    (channel: OrderType) => {
      clearEntryConflict();
      mutate((current) => ({
        ...current,
        channel,
        ...(channel === OrderType.DineIn ? {} : { tableId: undefined, serviceSessionId: undefined }),
      }));
    },
    [mutate, clearEntryConflict],
  );
  const setNotes = useCallback((notes: string) => mutate((current) => ({ ...current, notes })), [mutate]);
  const setTableNumber = useCallback(
    (tableNumber: string) => {
      clearEntryConflict();
      mutate((current) => ({
        ...current,
        tableNumber,
        tableId: undefined,
        serviceSessionId: undefined,
      }));
    },
    [mutate, clearEntryConflict],
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
    entryConflict,
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
