'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';

function referenceId(kind: OptionSetKind, entry: OptionSetEntry): string | undefined {
  return kind === 'ingredient' || kind === 'sauce' ? entry.globalIngredientId : entry.productId;
}

function existingReferenceKey(kind: OptionSetKind, entry: OptionSetEntry): string | undefined {
  const id = referenceId(kind, entry);
  return entry.id && id ? `${entry.id}:${kind}:${id}` : undefined;
}

export function useOptionSetReferences(
  kind: OptionSetKind | '',
  entries: readonly OptionSetEntry[],
  originalEntries: readonly OptionSetEntry[] = [],
) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const referenceKeys = useCallback(
    (rows: readonly OptionSetEntry[]) =>
      rows.flatMap((entry) => {
        const key = kind ? existingReferenceKey(kind, entry) : undefined;
        return key ? [key] : [];
      }),
    [kind],
  );
  const existingReferences = useMemo(() => new Set(referenceKeys(originalEntries)), [originalEntries, referenceKeys]);
  const currentReferences = useMemo(() => new Set(referenceKeys(entries)), [entries, referenceKeys]);

  const resetConfirmed = useCallback(() => setConfirmed({}), []);
  const markReferenceVerified = useCallback((referenceKind: OptionSetKind, candidate: MenuAuthoringCandidate) => {
    let matchesKind: boolean;
    if (referenceKind === 'ingredient' || referenceKind === 'sauce') {
      matchesKind = candidate.type === 'ingredient';
    } else if (referenceKind === 'suggestedSide') {
      matchesKind = candidate.type === 'product' && !candidate.isComponent;
    } else {
      matchesKind = candidate.type === 'product' || candidate.type === 'component';
    }
    setConfirmed((current) => ({
      ...current,
      [`${referenceKind}:${candidate.id}`]: matchesKind && candidate.isActive && candidate.isAvailable,
    }));
  }, []);

  const isReferenceAvailable = useCallback(
    (referenceKind: OptionSetKind, id: string, entryId?: string) => {
      const key = `${entryId}:${referenceKind}:${id}`;
      const isUnchangedSavedReference =
        referenceKind === kind && entryId !== undefined && existingReferences.has(key) && currentReferences.has(key);
      return isUnchangedSavedReference || (confirmed[`${referenceKind}:${id}`] ?? false);
    },
    [confirmed, currentReferences, existingReferences, kind],
  );

  return { isReferenceAvailable, markReferenceVerified, resetConfirmed };
}
