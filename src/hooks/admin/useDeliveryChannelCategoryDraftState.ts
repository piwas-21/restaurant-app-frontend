'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryCandidate,
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import {
  categoryDraftSelection,
  categorySelectionMatchesDraft,
  normalizedCategoryOverrides,
  toggleCategorySelection,
  updateCategoryItemOverride,
} from '@/utils/deliveryChannelMenuSelection';

export function useDeliveryChannelCategoryDraftState(
  draft: DeliveryChannelCategoryDraft | null,
  enabled: boolean,
  locked: boolean,
  limitRecoveryError: 'categoryLimit' | 'overrideLimit' | null = null,
) {
  const [categoryIds, setCategoryIds] = useState<ReadonlySet<string>>(new Set());
  const [overrides, setOverrides] = useState<Readonly<Record<string, DeliveryChannelCategoryItemOverride>>>({});
  const [selectionVersion, setSelectionVersion] = useState(0);
  const localEdits = useRef(false);
  const categoryIdsRef = useRef(categoryIds);
  const overridesRef = useRef(overrides);

  const adopt = useCallback((savedDraft: DeliveryChannelCategoryDraft | null) => {
    const selection = categoryDraftSelection(savedDraft);
    categoryIdsRef.current = selection.categoryIds;
    overridesRef.current = selection.overrides;
    setCategoryIds(selection.categoryIds);
    setOverrides(selection.overrides);
    localEdits.current = false;
    setSelectionVersion((value) => value + 1);
  }, []);

  const synchronize = useCallback(
    (savedDraft: DeliveryChannelCategoryDraft | null) => {
      if (!localEdits.current) adopt(savedDraft);
    },
    [adopt],
  );

  const dirty = useMemo(
    () => Boolean(draft && !categorySelectionMatchesDraft(draft, categoryIds, overrides)) || !draft,
    [categoryIds, draft, overrides],
  );

  const toggleCategory = useCallback(
    (categoryId: string, selected: boolean) => {
      if (!enabled || locked || (limitRecoveryError !== null && selected)) return;
      const next = toggleCategorySelection(categoryId, selected, categoryIds, overrides);
      localEdits.current = true;
      categoryIdsRef.current = next.categoryIds;
      overridesRef.current = next.overrides;
      setCategoryIds(next.categoryIds);
      setOverrides(next.overrides);
      setSelectionVersion((value) => value + 1);
    },
    [categoryIds, enabled, limitRecoveryError, locked, overrides],
  );

  const toggleItem = useCallback(
    (item: DeliveryChannelCategoryCandidate, selected: boolean) => {
      if (
        !enabled ||
        locked ||
        limitRecoveryError === 'categoryLimit' ||
        (limitRecoveryError === 'overrideLimit' && !overrides[item.selectionKey])
      )
        return;
      localEdits.current = true;
      setOverrides((current) => {
        const next = updateCategoryItemOverride(item, selected, categoryIds, current);
        overridesRef.current = next;
        return next;
      });
      setSelectionVersion((value) => value + 1);
    },
    [categoryIds, enabled, limitRecoveryError, locked, overrides],
  );

  const markSaved = useCallback(
    (savedDraft: DeliveryChannelCategoryDraft) => {
      adopt(savedDraft);
    },
    [adopt],
  );

  const reconcileToInventory = useCallback((current: DeliveryChannelCategoryInventory) => {
    const selectedCategories = categoryIdsRef.current;
    const selectedOverrides = overridesRef.current;
    const categorySet = new Set(current.categories.map((category) => category.categoryId));
    const removedCategories = new Set(current.removedCategoryIds ?? []);
    const removedOverrideKeys = new Set(
      [...(current.removedItems ?? []), ...(current.removedItemOverrides ?? [])].map(
        (override) => override.selectionKey,
      ),
    );
    const nextCategoryIds = new Set(
      [...selectedCategories].filter((categoryId) => categorySet.has(categoryId) && !removedCategories.has(categoryId)),
    );
    const nextOverrides = Object.fromEntries(
      normalizedCategoryOverrides(selectedCategories, selectedOverrides)
        .filter(
          (override) =>
            categorySet.has(override.categoryId) &&
            !removedCategories.has(override.categoryId) &&
            !removedOverrideKeys.has(override.selectionKey),
        )
        .map((override) => [override.selectionKey, override]),
    );
    const changed =
      nextCategoryIds.size !== selectedCategories.size ||
      Object.keys(nextOverrides).length !== Object.keys(selectedOverrides).length;
    if (!changed) return false;
    localEdits.current = true;
    categoryIdsRef.current = nextCategoryIds;
    overridesRef.current = nextOverrides;
    setCategoryIds(nextCategoryIds);
    setOverrides(nextOverrides);
    setSelectionVersion((value) => value + 1);
    return true;
  }, []);

  return {
    categoryIds,
    overrides,
    selectionVersion,
    dirty,
    toggleCategory,
    toggleItem,
    adopt,
    synchronize,
    markSaved,
    reconcileToInventory,
  };
}
