'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchMenuAuthoring } from '@/services/menuAuthoringSearchService';
import { getErrorMessage } from '@/utils/apiClient';
import type { MenuAuthoringCandidate } from '@/types/menuAuthoringSearch';
import type { OptionSetKind } from '@/types/optionSet';

const SEARCH_DELAY_MS = 250;
const SEARCH_LIMIT = 24;

export function useMenuAuthoringSearch(forKind?: OptionSetKind) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MenuAuthoringCandidate[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const loadFirst = useCallback(
    async (searchText = query) => {
      const text = searchText.trim();
      const request = ++requestId.current;
      if (text.length < 2) {
        setItems([]);
        setNextCursor(null);
        setError(null);
        setIsLoading(false);
        return;
      }
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsLoading(true);
      setError(null);
      try {
        const result = await searchMenuAuthoring({ query: text, forKind, limit: SEARCH_LIMIT }, controller.signal);
        if (request !== requestId.current) return;
        setItems(result.items);
        setNextCursor(result.nextCursor ?? null);
      } catch (searchError) {
        if (request === requestId.current) {
          setItems([]);
          setNextCursor(null);
          setError(getErrorMessage(searchError) ?? 'menu_authoring_search_error');
        }
      } finally {
        if (request === requestId.current) setIsLoading(false);
      }
    },
    [forKind, query],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadFirst(), SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timeout);
      controllerRef.current?.abort();
    };
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || query.trim().length < 2 || isLoadingMore) return;
    const request = requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoadingMore(true);
    try {
      const result = await searchMenuAuthoring(
        {
          query: query.trim(),
          forKind,
          cursor: nextCursor,
          limit: SEARCH_LIMIT,
        },
        controller.signal,
      );
      if (request !== requestId.current) return;
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor ?? null);
    } catch (pageError) {
      void pageError;
      if (request === requestId.current) setError(getErrorMessage(pageError) ?? 'menu_authoring_search_error');
    } finally {
      if (request === requestId.current) setIsLoadingMore(false);
    }
  }, [forKind, isLoadingMore, nextCursor, query]);

  const retry = useCallback(() => loadFirst(), [loadFirst]);

  return { query, setQuery, items, nextCursor, isLoading, isLoadingMore, error, loadMore, retry };
}
