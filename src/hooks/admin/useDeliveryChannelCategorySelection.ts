'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelCategoryInventory } from '@/types/deliveryChannelMenuSelection';
import { deliveryChannelCategorySelectionMetrics } from '@/utils/deliveryChannelCategorySelectionMetrics';
import { useDeliveryChannelCategorySourceAcknowledgement } from './useDeliveryChannelCategorySourceAcknowledgement';
import { useDeliveryChannelCategoryCandidates } from './useDeliveryChannelCategoryCandidates';
import { useDeliveryChannelCategoryDraftState } from './useDeliveryChannelCategoryDraftState';
import {
  categorySaveAttemptMatches,
  useDeliveryChannelCategoryDraftSave,
  type CategorySaveAttempt,
  type CategorySelectionError,
} from './useDeliveryChannelCategoryDraftSave';
import { categoryInventoryIsSourceMismatched } from '@/utils/deliveryChannelCategorySource';
import { applyCanonicalCategoryInventoryRead } from '@/utils/deliveryChannelCategoryInventoryRead';
import { useDeliveryChannelCategoryLoadError } from './useDeliveryChannelCategoryLoadError';

export function useDeliveryChannelCategorySelection(enabled: boolean) {
  const { captureLoadError, clear: clearLoadError, message: loadErrorMessage } = useDeliveryChannelCategoryLoadError();
  const [inventory, setInventory] = useState<DeliveryChannelCategoryInventory | null>(null);
  const [busy, setBusy] = useState<'load' | 'save' | null>(null);
  const [error, setError] = useState<CategorySelectionError | null>(null);
  const [acknowledgedSourceRevision, setAcknowledgedSourceRevision] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  const [writeUncertain, setWriteUncertain] = useState(false);
  const [removedSelectionNotice, setRemovedSelectionNotice] = useState(false);
  const inventorySequence = useRef(0);
  const inventoryLoaded = useRef(false);
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;
  const acknowledgement = useRef<string | null>(null);
  const uncertainWrite = useRef(false);
  const saveAttempt = useRef<CategorySaveAttempt | null>(null);
  const candidates = useDeliveryChannelCategoryCandidates(enabled, inventory?.sourceRevision ?? null);
  const sourceMismatch = categoryInventoryIsSourceMismatched(inventory);
  const sourceStale =
    saveConflict ||
    candidates.cursorStale ||
    Boolean(sourceMismatch && acknowledgedSourceRevision !== inventory?.sourceRevision);
  const limitRecoveryError = saveConflict && (error === 'categoryLimit' || error === 'overrideLimit') ? error : null;
  const selectionLocked =
    busy !== null ||
    writeUncertain ||
    (sourceStale && (!limitRecoveryError || candidates.cursorStale || candidates.error));
  const draftState = useDeliveryChannelCategoryDraftState(
    inventory?.draft ?? null,
    enabled,
    selectionLocked,
    limitRecoveryError,
  );
  const { markSaved: markDraftSaved, synchronize: synchronizeDraft, reconcileToInventory } = draftState;
  const recordAcknowledgement = useCallback((revision: string | null) => {
    acknowledgement.current = revision;
    setAcknowledgedSourceRevision(revision);
  }, []);

  const loadInventory = useCallback(
    async (acknowledgeSource: boolean) => {
      if (!enabled) return null;
      const requestId = ++inventorySequence.current;
      if (!inventoryLoaded.current || acknowledgeSource) setBusy('load');
      try {
        const loaded = await deliveryChannelManagementService.getCategoryInventory();
        if (requestId !== inventorySequence.current) return null;
        const result = applyCanonicalCategoryInventoryRead({
          loaded,
          previous: inventoryRef.current,
          attempt: saveAttempt.current,
          uncertainWrite,
          matchesAttempt: categorySaveAttemptMatches,
          markDraftSaved,
          synchronizeDraft,
          clearAttempt: () => {
            saveAttempt.current = null;
          },
          setWriteUncertain,
          setError,
        });
        clearLoadError();
        inventoryLoaded.current = true;
        const mismatch = categoryInventoryIsSourceMismatched(result);
        setInventory(result);
        if (!acknowledgeSource && !mismatch) recordAcknowledgement(result.sourceRevision);
        else if (!acknowledgeSource && acknowledgement.current !== result.sourceRevision) recordAcknowledgement(null);
        if (!uncertainWrite.current) setError(null);
        return result;
      } catch (cause: unknown) {
        if (requestId === inventorySequence.current) {
          captureLoadError(cause);
          setError('load');
        }
        return null;
      } finally {
        if (requestId === inventorySequence.current) setBusy(null);
      }
    },
    [captureLoadError, clearLoadError, enabled, markDraftSaved, recordAcknowledgement, synchronizeDraft],
  );

  const refresh = useCallback(async () => Boolean(await loadInventory(false)), [loadInventory]);
  const acknowledgeSource = useDeliveryChannelCategorySourceAcknowledgement({
    categoryIds: draftState.categoryIds,
    overrides: draftState.overrides,
    loadInventory,
    refreshCandidates: candidates.refreshCurrentQuery,
    reconcileToInventory,
    recordAcknowledgement,
    setInventory,
    setBusy,
    setError,
    setConflict: setSaveConflict,
    setRemovedSelectionNotice,
  });

  const refreshCanonical = useCallback(() => loadInventory(false), [loadInventory]);

  useEffect(() => {
    if (enabled) void loadInventory(false);
    return () => {
      inventorySequence.current += 1;
    };
  }, [enabled, loadInventory]);

  useEffect(() => {
    uncertainWrite.current = writeUncertain;
  }, [writeUncertain]);

  const selectionMetrics = useMemo(
    () =>
      deliveryChannelCategorySelectionMetrics({
        inventory,
        stale: sourceStale,
        categoryIds: draftState.categoryIds,
        overrides: draftState.overrides,
        knownCandidates: candidates.knownCandidates,
      }),
    [inventory, sourceStale, draftState.categoryIds, draftState.overrides, candidates.knownCandidates],
  );
  const { categories, knownItems, selectedCount, unsupportedCount } = selectionMetrics;
  const needsSave = Boolean(inventory && (draftState.dirty || sourceMismatch || !inventory.draft));

  useEffect(() => {
    if (inventory && !needsSave && !sourceStale) setRemovedSelectionNotice(false);
  }, [inventory, needsSave, sourceStale]);

  const saveDraft = useDeliveryChannelCategoryDraftSave({
    enabled,
    inventory,
    categoryIds: draftState.categoryIds,
    overrides: draftState.overrides,
    needsSave,
    locked: sourceStale,
    busy,
    writeUncertain,
    saveAttempt,
    uncertainWrite,
    setInventory,
    setBusy,
    setError,
    setConflict: setSaveConflict,
    setWriteUncertain,
    recordAcknowledgement,
    markSaved: markDraftSaved,
    refreshCanonical,
  });

  return {
    inventory,
    categories,
    categoryIds: draftState.categoryIds,
    overrides: draftState.overrides,
    selectedCount,
    unsupportedCount,
    knownItems,
    candidates: candidates.candidates,
    candidateCursor: candidates.cursor,
    candidateBusy: candidates.busy,
    candidateError: candidates.error,
    searchCandidates: candidates.search,
    loadMoreCandidates: candidates.loadMore,
    selectionVersion: draftState.selectionVersion,
    busy,
    error,
    loadErrorMessage: error === 'load' ? loadErrorMessage : null,
    dirty: draftState.dirty,
    needsSave,
    stale: sourceStale,
    selectionLocked,
    writeUncertain,
    removedSelectionNotice,
    refresh,
    acknowledgeSource,
    toggleCategory: draftState.toggleCategory,
    toggleItem: draftState.toggleItem,
    saveDraft,
  };
}
