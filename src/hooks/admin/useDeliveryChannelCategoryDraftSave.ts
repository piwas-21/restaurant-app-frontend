'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { ApiError } from '@/utils/apiClient';
import {
  classifyDeliveryChannelMutationFailure,
  deliveryChannelManagementService,
} from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import {
  categorySelectionCount,
  categoryOverrideRequests,
  categorySelectionMatchesDraft,
  normalizedCategoryOverrides,
} from '@/utils/deliveryChannelMenuSelection';

export type CategorySelectionError =
  'load' | 'selectionLimit' | 'categoryLimit' | 'overrideLimit' | 'stale' | 'uncertain' | 'rejected';

export interface CategorySaveAttempt {
  readonly sourceRevision: string;
  readonly categoryIds: ReadonlySet<string>;
  readonly overrides: Readonly<Record<string, DeliveryChannelCategoryItemOverride>>;
}

interface Props {
  readonly enabled: boolean;
  readonly inventory: DeliveryChannelCategoryInventory | null;
  readonly categoryIds: ReadonlySet<string>;
  readonly overrides: Readonly<Record<string, DeliveryChannelCategoryItemOverride>>;
  readonly needsSave: boolean;
  readonly locked: boolean;
  readonly busy: 'load' | 'save' | null;
  readonly writeUncertain: boolean;
  readonly saveAttempt: MutableRefObject<CategorySaveAttempt | null>;
  readonly uncertainWrite: MutableRefObject<boolean>;
  readonly setInventory: Dispatch<SetStateAction<DeliveryChannelCategoryInventory | null>>;
  readonly setBusy: Dispatch<SetStateAction<'load' | 'save' | null>>;
  readonly setError: Dispatch<SetStateAction<CategorySelectionError | null>>;
  readonly setConflict: Dispatch<SetStateAction<boolean>>;
  readonly setWriteUncertain: Dispatch<SetStateAction<boolean>>;
  readonly recordAcknowledgement: (revision: string | null) => void;
  readonly markSaved: (draft: DeliveryChannelCategoryDraft) => void;
  readonly refreshCanonical: () => Promise<void>;
}

export function categorySaveAttemptMatches(draft: DeliveryChannelCategoryDraft | null, attempt: CategorySaveAttempt) {
  return Boolean(
    draft &&
    draft.sourceRevision === attempt.sourceRevision &&
    categorySelectionMatchesDraft(draft, attempt.categoryIds, attempt.overrides),
  );
}

function categorySaveFailure(cause: unknown): CategorySelectionError {
  if (cause instanceof ApiError) {
    const errors: Record<string, CategorySelectionError> = {
      SelectionLimitExceeded: 'selectionLimit',
      CategoryLimitExceeded: 'categoryLimit',
      SelectionOverrideLimitExceeded: 'overrideLimit',
    };
    if (errors[cause.errorCode ?? '']) return errors[cause.errorCode ?? ''];
  }
  return classifyDeliveryChannelMutationFailure(cause);
}

export function useDeliveryChannelCategoryDraftSave({
  enabled,
  inventory,
  categoryIds,
  overrides,
  needsSave,
  locked,
  busy,
  writeUncertain,
  saveAttempt,
  uncertainWrite,
  setInventory,
  setBusy,
  setError,
  setConflict,
  setWriteUncertain,
  recordAcknowledgement,
  markSaved,
  refreshCanonical,
}: Readonly<Props>) {
  return useCallback(async () => {
    if (!enabled || !inventory || !needsSave || locked || writeUncertain || busy) return false;
    const itemOverrides = categoryOverrideRequests(categoryIds, overrides);
    if (categorySelectionCount(inventory.categories, categoryIds, overrides) > inventory.maximumSelectedItemCount) {
      setError('selectionLimit');
      return false;
    }
    if (categoryIds.size > inventory.maximumCategoryCount) {
      setError('categoryLimit');
      return false;
    }
    if (itemOverrides.length > inventory.maximumItemOverrideCount) {
      setError('overrideLimit');
      return false;
    }
    const attempt: CategorySaveAttempt = {
      sourceRevision: inventory.sourceRevision,
      categoryIds: new Set(categoryIds),
      overrides: Object.fromEntries(
        normalizedCategoryOverrides(categoryIds, overrides).map((override) => [override.selectionKey, override]),
      ),
    };
    saveAttempt.current = attempt;
    setBusy('save');
    setError(null);
    try {
      const draft = await deliveryChannelManagementService.saveCategoryDraft({
        expectedDraftRevision: inventory.draft?.draftRevision ?? inventory.draftRevision ?? null,
        expectedSourceRevision: inventory.sourceRevision,
        categoryIds: [...attempt.categoryIds].sort(),
        itemOverrides,
      });
      setInventory((current) =>
        current ? { ...current, draft, draftRevision: draft.draftRevision, sourceChanged: false } : current,
      );
      markSaved(draft);
      recordAcknowledgement(draft.sourceRevision);
      setConflict(false);
      uncertainWrite.current = false;
      saveAttempt.current = null;
      setWriteUncertain(false);
      setError(null);
      return true;
    } catch (cause) {
      const failure = categorySaveFailure(cause);
      if (failure !== 'uncertain') {
        saveAttempt.current = null;
        setError(failure);
        if (failure === 'stale') {
          setConflict(true);
          await refreshCanonical();
        }
        return false;
      }
      uncertainWrite.current = true;
      setWriteUncertain(true);
      setError('uncertain');
      await refreshCanonical();
      return false;
    } finally {
      setBusy(null);
    }
  }, [
    busy,
    categoryIds,
    enabled,
    inventory,
    locked,
    markSaved,
    needsSave,
    overrides,
    recordAcknowledgement,
    refreshCanonical,
    saveAttempt,
    setBusy,
    setConflict,
    setError,
    setInventory,
    setWriteUncertain,
    uncertainWrite,
    writeUncertain,
  ]);
}
