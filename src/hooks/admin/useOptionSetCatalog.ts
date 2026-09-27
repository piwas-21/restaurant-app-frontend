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
  const activeRequests = useRef(new Set<AbortController>());

  const loadFirst = useCallback(async () => {
    activeRequests.current.forEach((controller) => controller.abort());
    activeRequests.current.clear();
    const controller = new AbortController();
    activeRequests.current.add(controller);
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    try {
      const result = await searchOptionSets({ kind: kind || undefined, query, limit: 24 }, controller.signal);
      if (currentRequest !== requestId.current) return;
      setItems(result.items);
      setNextCursor(result.nextCursor ?? null);
    } catch (searchError) {
      if (currentRequest === requestId.current && !controller.signal.aborted) {
        setItems([]);
        setNextCursor(null);
        setError(getErrorMessage(searchError) ?? 'option_set_load_error');
      }
    } finally {
      activeRequests.current.delete(controller);
      if (currentRequest === requestId.current && !controller.signal.aborted) setIsLoading(false);
    }
  }, [kind, query]);

  useEffect(() => {
    const requestControllers = activeRequests.current;
    const timeout = window.setTimeout(() => void loadFirst(), 250);
    return () => {
      window.clearTimeout(timeout);
      requestId.current += 1;
      requestControllers.forEach((controller) => controller.abort());
      requestControllers.clear();
    };
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    const controller = new AbortController();
    activeRequests.current.add(controller);
    const currentRequest = requestId.current;
    setIsLoadingMore(true);
    try {
      const result = await searchOptionSets(
        { kind: kind || undefined, query, cursor: nextCursor, limit: 24 },
        controller.signal,
      );
      if (currentRequest !== requestId.current) return;
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor ?? null);
    } catch (pageError) {
      if (currentRequest === requestId.current && !controller.signal.aborted) {
        setError(getErrorMessage(pageError) ?? 'option_set_load_error');
      }
    } finally {
      activeRequests.current.delete(controller);
      if (currentRequest === requestId.current && !controller.signal.aborted) setIsLoadingMore(false);
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
