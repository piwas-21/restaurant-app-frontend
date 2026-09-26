'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/config/languageConfig';
import {
  listCatalogueTemplates,
  type CatalogueTemplateListResponse,
  type CatalogueTemplateType,
} from '@/services/catalogueTemplateService';
import { serverMessage } from '@/utils/apiFormErrors';

export interface CatalogueTemplateFilters {
  readonly type: CatalogueTemplateType | '';
  readonly cuisine: string;
  readonly query: string;
  readonly locale: LanguageCode;
}

const emptyPage: CatalogueTemplateListResponse = { items: [], nextCursor: null };

export function useCatalogueTemplateSearch(initialLocale: LanguageCode) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [filters, setFilters] = useState<CatalogueTemplateFilters>({
    type: '',
    cuisine: '',
    query: '',
    locale: initialLocale,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState(emptyPage);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setAppliedFilters(filters),
      filters.query === appliedFilters.query ? 0 : 250,
    );
    return () => window.clearTimeout(timeout);
  }, [filters, appliedFilters.query]);

  const currentCursor = cursorStack[pageIndex] ?? null;
  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    setPage(emptyPage);

    void listCatalogueTemplates(
      {
        type: appliedFilters.type,
        cuisine: appliedFilters.cuisine,
        q: appliedFilters.query,
        locale: appliedFilters.locale,
        cursor: currentCursor,
        limit: 24,
      },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setPage(response);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setPage(emptyPage);
        setError(serverMessage(reason) ?? tRef.current('catalogue_load_error'));
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setIsLoading(false);
      });

    return () => {
      requestSequence.current += 1;
      controller.abort();
    };
  }, [appliedFilters, currentCursor, retryKey]);

  const updateFilter = useCallback(
    <K extends keyof CatalogueTemplateFilters>(key: K, value: CatalogueTemplateFilters[K]) => {
      setFilters((current) => (current[key] === value ? current : { ...current, [key]: value }));
      setCursorStack([null]);
      setPageIndex(0);
    },
    [],
  );

  const goToNextPage = useCallback(() => {
    if (!page.nextCursor || isLoading) return;
    const nextCursor = page.nextCursor;
    setCursorStack((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((current) => current + 1);
  }, [isLoading, page.nextCursor, pageIndex]);

  const goToPreviousPage = useCallback(() => {
    if (pageIndex === 0 || isLoading) return;
    setPageIndex((current) => Math.max(0, current - 1));
  }, [isLoading, pageIndex]);

  return {
    filters,
    updateFilter,
    templates: page.items,
    isLoading,
    error,
    retry: () => setRetryKey((current) => current + 1),
    hasNextPage: Boolean(page.nextCursor),
    hasPreviousPage: pageIndex > 0,
    pageNumber: pageIndex + 1,
    goToNextPage,
    goToPreviousPage,
  };
}
