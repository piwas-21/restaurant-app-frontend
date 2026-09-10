'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createOrderOperationalNote, getOrderOperationalNotes } from '@/services/orderOperationalNoteService';
import type { OrderOperationalNoteAudience, OrderOperationalNoteDto } from '@/types/orderOperationalNote';

interface OperationalNoteDraft {
  text: string;
  audience: OrderOperationalNoteAudience;
}

const emptyDraft = (): OperationalNoteDraft => ({ text: '', audience: 'Kitchen' });

const operationId = (): string => crypto.randomUUID();

export function useOrderOperationalNotes(orderId: string, enabled = true) {
  const [notes, setNotes] = useState<OrderOperationalNoteDto[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OperationalNoteDraft>>({});
  const [loadingError, setLoadingError] = useState<unknown>(null);
  const [savingError, setSavingError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingOrderIds, setSavingOrderIds] = useState<Record<string, boolean>>({});
  const activeOrderId = useRef(orderId);
  activeOrderId.current = orderId;

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setLoadingError(null);
      setNotes([]);
      return;
    }

    let current = true;
    setIsLoading(true);
    setLoadingError(null);
    setNotes([]);

    void getOrderOperationalNotes(orderId)
      .then((loadedNotes) => {
        if (current) setNotes(loadedNotes);
      })
      .catch((error: unknown) => {
        if (current) setLoadingError(error);
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => {
      current = false;
    };
  }, [enabled, orderId]);

  const draft = drafts[orderId] ?? emptyDraft();
  const updateDraft = useCallback(
    (patch: Partial<OperationalNoteDraft>) => {
      setDrafts((current) => ({ ...current, [orderId]: { ...(current[orderId] ?? emptyDraft()), ...patch } }));
    },
    [orderId],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const currentDraft = drafts[orderId] ?? emptyDraft();
    const text = currentDraft.text.trim();
    if (!text || savingOrderIds[orderId]) return false;

    setSavingError(null);
    setSavingOrderIds((current) => ({ ...current, [orderId]: true }));
    try {
      const note = await createOrderOperationalNote(orderId, {
        text,
        audience: currentDraft.audience,
        clientOperationId: operationId(),
      });
      if (activeOrderId.current === orderId) setNotes((current) => [...current, note]);
      setDrafts((current) => ({
        ...current,
        [orderId]: { ...(current[orderId] ?? emptyDraft()), text: '' },
      }));
      return true;
    } catch (error) {
      setSavingError(error);
      return false;
    } finally {
      setSavingOrderIds((current) => ({ ...current, [orderId]: false }));
    }
  }, [drafts, orderId, savingOrderIds]);

  return {
    notes,
    draft,
    isLoading,
    isSaving: Boolean(savingOrderIds[orderId]),
    loadingError,
    savingError,
    setText: (text: string) => updateDraft({ text }),
    setAudience: (audience: OrderOperationalNoteAudience) => updateDraft({ audience }),
    save,
  };
}
