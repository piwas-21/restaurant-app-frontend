'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import { isOptionSetReferenceAvailable } from '@/services/optionSetReferenceService';

const REFERENCE_CHECK_CONCURRENCY = 4;

function referenceId(kind: OptionSetKind, entry: OptionSetEntry): string | undefined {
  return kind === 'ingredient' || kind === 'sauce' ? entry.globalIngredientId : entry.productId;
}

export function useOptionSetReferences(kind: OptionSetKind | '', entries: readonly OptionSetEntry[]) {
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const references = useMemo(() => {
    if (!kind) return [];
    return [...new Set(entries.map((entry) => referenceId(kind, entry)).filter((id): id is string => Boolean(id)))];
  }, [entries, kind]);
  const referenceKey = references.join('|');
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    if (!kind || referenceKey.length === 0) {
      setIsLoading(false);
      setError(false);
      return;
    }
    let active = true;
    const selectedReferences = referenceKey ? referenceKey.split('|') : [];
    setIsLoading(true);
    setError(false);
    const check = async () => {
      const next: Record<string, boolean> = {};
      let failed = false;
      for (let index = 0; index < selectedReferences.length; index += REFERENCE_CHECK_CONCURRENCY) {
        const batch = selectedReferences.slice(index, index + REFERENCE_CHECK_CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (id) => {
            try {
              return [id, await isOptionSetReferenceAvailable(kind, id)] as const;
            } catch (_referenceError) {
              /* Intentionally report availability as false and expose the aggregate retry state. */
              failed = true;
              return [id, false] as const;
            }
          }),
        );
        results.forEach(([id, isAvailable]) => {
          next[`${kind}:${id}`] = isAvailable;
        });
      }
      if (active) {
        setAvailability((current) => ({ ...current, ...next }));
        setError(failed);
        setIsLoading(false);
      }
    };
    void check();
    return () => {
      active = false;
    };
    // The joined key tracks only selected canonical IDs; name and price edits do not refetch.
  }, [kind, referenceKey, reloadCount]);

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
    (referenceKind: OptionSetKind, id: string) =>
      confirmed[`${referenceKind}:${id}`] ?? availability[`${referenceKind}:${id}`] ?? false,
    [availability, confirmed],
  );

  return { isLoading, error, isReferenceAvailable, markReferenceVerified, reload };
}
