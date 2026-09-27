'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchOptionSets } from '@/services/optionSetService';
import { getErrorMessage } from '@/utils/apiClient';
import type { OptionSetKind, OptionSetSummary } from '@/types/optionSet';

export function useOptionSetCatalog() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<OptionSetKind | ''>('');
  const [items, setItems] = useState<OptionSetSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadFirst = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchOptionSets({ kind: kind || undefined, query, limit: 24 });
      if (currentRequest !== requestId.current) return;
      setItems(result.items);
      setNextCursor(result.nextCursor ?? null);
    } catch (searchError) {
      if (currentRequest === requestId.current) {
        setItems([]);
        setNextCursor(null);
        setError(getErrorMessage(searchError) ?? 'option_set_load_error');
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [kind, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadFirst(), 250);
    return () => window.clearTimeout(timeout);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    const currentRequest = requestId.current;
    setIsLoadingMore(true);
    try {
      const result = await searchOptionSets({ kind: kind || undefined, query, cursor: nextCursor, limit: 24 });
      if (currentRequest !== requestId.current) return;
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor ?? null);
    } catch (pageError) {
      if (currentRequest === requestId.current) setError(getErrorMessage(pageError) ?? 'option_set_load_error');
    } finally {
      if (currentRequest === requestId.current) setIsLoadingMore(false);
    }
  }, [isLoadingMore, kind, nextCursor, query]);

  return {
    query,
    setQuery,
    kind,
    setKind,
    items,
    nextCursor,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry: loadFirst,
  };
}
