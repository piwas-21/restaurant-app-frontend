'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelCategoryCandidate } from '@/types/deliveryChannelMenuSelection';
import { ApiError } from '@/utils/apiClient';

export function useDeliveryChannelCategoryCandidates(enabled: boolean, sourceRevision: string | null) {
  const [candidates, setCandidates] = useState<readonly DeliveryChannelCategoryCandidate[]>([]);
  const [knownCandidates, setKnownCandidates] = useState<readonly DeliveryChannelCategoryCandidate[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [cursorStale, setCursorStale] = useState(false);
  const requestSequence = useRef(0);
  const currentQuery = useRef({ search: '', categoryId: null as string | null, key: '' });
  const sourceRevisionRef = useRef(sourceRevision);

  const search = useCallback(
    async (
      searchText: string,
      categoryId: string | null,
      nextCursor: string | null = null,
      requestedSourceRevision = sourceRevision,
    ) => {
      if (!enabled || !requestedSourceRevision) return false;
      const queryKey = JSON.stringify([searchText, categoryId, requestedSourceRevision]);
      const append = nextCursor !== null && queryKey === currentQuery.current.key;
      const requestId = ++requestSequence.current;
      if (!append) {
        currentQuery.current = { search: searchText, categoryId, key: queryKey };
        setCandidates([]);
        setCursor(null);
        setCursorStale(false);
      }
      setBusy(true);
      setError(false);
      try {
        const result = await deliveryChannelManagementService.getCategoryCandidates(
          searchText,
          categoryId,
          append ? nextCursor : null,
          requestedSourceRevision,
        );
        if (requestId !== requestSequence.current) return false;
        if (result.sourceRevision !== requestedSourceRevision) {
          setError(true);
          setCursor(null);
          setCursorStale(true);
          return false;
        }
        setCandidates((current) => (append ? [...current, ...result.items] : result.items));
        setKnownCandidates((current) => mergeCandidates(current, result.items));
        setCursor(result.nextCursor);
        setCursorStale(false);
        return true;
      } catch (cause) {
        if (requestId === requestSequence.current) {
          setError(true);
          if (cause instanceof ApiError && cause.status === 409) {
            setCursor(null);
            setCursorStale(true);
          } else if (!append) {
            setCandidates([]);
            setCursor(null);
          }
        }
        return false;
      } finally {
        if (requestId === requestSequence.current) setBusy(false);
      }
    },
    [enabled, sourceRevision],
  );

  useEffect(() => {
    if (sourceRevisionRef.current !== sourceRevision) {
      sourceRevisionRef.current = sourceRevision;
      requestSequence.current += 1;
      setCandidates([]);
      setKnownCandidates([]);
      setCursor(null);
      setCursorStale(false);
      currentQuery.current = { ...currentQuery.current, key: '' };
    }
    if (enabled && sourceRevision) {
      void search(currentQuery.current.search, currentQuery.current.categoryId, null, sourceRevision);
    }
    return () => {
      requestSequence.current += 1;
    };
  }, [enabled, sourceRevision, search]);

  const loadMore = useCallback(() => {
    if (!cursor) return Promise.resolve(false);
    return search(currentQuery.current.search, currentQuery.current.categoryId, cursor);
  }, [cursor, search]);

  const refreshCurrentQuery = useCallback(
    (revision: string) => {
      if (sourceRevisionRef.current !== revision) setKnownCandidates([]);
      sourceRevisionRef.current = revision;
      return search(currentQuery.current.search, currentQuery.current.categoryId, null, revision);
    },
    [search],
  );

  return { candidates, knownCandidates, cursor, busy, error, cursorStale, search, loadMore, refreshCurrentQuery };
}

function mergeCandidates(
  current: readonly DeliveryChannelCategoryCandidate[],
  incoming: readonly DeliveryChannelCategoryCandidate[],
): readonly DeliveryChannelCategoryCandidate[] {
  const merged = new Map(current.map((item) => [item.selectionKey, item]));
  for (const item of incoming) merged.set(item.selectionKey, item);
  return [...merged.values()];
}
