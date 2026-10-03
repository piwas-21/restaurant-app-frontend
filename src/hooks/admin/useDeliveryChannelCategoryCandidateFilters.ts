'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeliveryChannelCategorySummary } from '@/types/deliveryChannelMenuSelection';

type SearchCandidates = (query: string, categoryId: string | null) => Promise<boolean>;

export function useDeliveryChannelCategoryCandidateFilters(
  sourceRevision: string,
  categories: readonly DeliveryChannelCategorySummary[],
  onSearch: SearchCandidates,
) {
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const sourceRevisionRef = useRef(sourceRevision);

  useEffect(() => {
    if (sourceRevisionRef.current === sourceRevision) return;
    sourceRevisionRef.current = sourceRevision;
    if (!categoryFilter || categories.some((category) => category.categoryId === categoryFilter)) return;
    setCategoryFilter('');
    setAppliedQuery(query);
    void onSearch(query, null);
  }, [categories, categoryFilter, onSearch, query, sourceRevision]);

  const search = useCallback(() => {
    setAppliedQuery(query);
    void onSearch(query, categoryFilter || null);
  }, [categoryFilter, onSearch, query]);

  const changeCategory = useCallback(
    (value: string) => {
      setCategoryFilter(value);
      setAppliedQuery(query);
      void onSearch(query, value || null);
    },
    [onSearch, query],
  );

  return { query, setQuery, appliedQuery, categoryFilter, search, changeCategory };
}
