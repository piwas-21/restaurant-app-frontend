'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import { ApiError } from '@/utils/apiClient';
import { refreshCategoryReferenceSnapshot } from '@/utils/deliveryChannelCategorySource';
import type { CategorySelectionError } from './useDeliveryChannelCategoryDraftSave';

interface Props {
  readonly categoryIds: ReadonlySet<string>;
  readonly overrides: Readonly<Record<string, DeliveryChannelCategoryItemOverride>>;
  readonly loadInventory: (acknowledgeSource: boolean) => Promise<DeliveryChannelCategoryInventory | null>;
  readonly refreshCandidates: (sourceRevision: string) => Promise<boolean>;
  readonly reconcileToInventory: (inventory: DeliveryChannelCategoryInventory) => boolean;
  readonly recordAcknowledgement: (revision: string | null) => void;
  readonly setInventory: Dispatch<SetStateAction<DeliveryChannelCategoryInventory | null>>;
  readonly setBusy: Dispatch<SetStateAction<'load' | 'save' | null>>;
  readonly setError: Dispatch<SetStateAction<CategorySelectionError | null>>;
  readonly setConflict: Dispatch<SetStateAction<boolean>>;
  readonly setRemovedSelectionNotice: Dispatch<SetStateAction<boolean>>;
}

function referenceRefreshError(cause: unknown): CategorySelectionError {
  if (cause instanceof ApiError) {
    if (cause.errorCode === 'CategoryLimitExceeded') return 'categoryLimit';
    if (cause.errorCode === 'SelectionOverrideLimitExceeded') return 'overrideLimit';
    if (cause.status === 409) return 'stale';
  }
  return 'load';
}

export function useDeliveryChannelCategorySourceAcknowledgement({
  categoryIds,
  overrides,
  loadInventory,
  refreshCandidates,
  reconcileToInventory,
  recordAcknowledgement,
  setInventory,
  setBusy,
  setError,
  setConflict,
  setRemovedSelectionNotice,
}: Readonly<Props>) {
  return useCallback(async () => {
    recordAcknowledgement(null);
    setConflict(true);
    setError(null);
    const current = await loadInventory(true);
    if (!current) {
      recordAcknowledgement(null);
      setConflict(true);
      setError('load');
      return false;
    }
    setBusy('load');
    try {
      const refreshed = await refreshCategoryReferenceSnapshot(current, categoryIds, overrides);
      const candidatesLoaded = await refreshCandidates(refreshed.sourceRevision);
      if (!candidatesLoaded) {
        recordAcknowledgement(null);
        setConflict(true);
        setError('load');
        return false;
      }
      setInventory(refreshed);
      const removed = Boolean(
        refreshed.removedCategoryIds?.length ||
        refreshed.removedItems?.length ||
        refreshed.removedItemOverrides?.length,
      );
      if (reconcileToInventory(refreshed) || removed) setRemovedSelectionNotice(true);
      recordAcknowledgement(refreshed.sourceRevision);
      setConflict(false);
      setError(null);
      return true;
    } catch (cause) {
      recordAcknowledgement(null);
      setConflict(true);
      setError(referenceRefreshError(cause));
      return false;
    } finally {
      setBusy(null);
    }
  }, [
    categoryIds,
    loadInventory,
    overrides,
    reconcileToInventory,
    recordAcknowledgement,
    refreshCandidates,
    setBusy,
    setConflict,
    setError,
    setInventory,
    setRemovedSelectionNotice,
  ]);
}
