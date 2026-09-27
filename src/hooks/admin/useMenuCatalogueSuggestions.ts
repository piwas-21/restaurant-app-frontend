'use client';

import { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '@/config/languageConfig';
import { listCatalogueTemplates, type CatalogueTemplateSummary } from '@/services/catalogueTemplateService';
import { serverMessage } from '@/utils/apiFormErrors';

const MIN_QUERY_LENGTH = 2;
const REQUEST_LIMIT = 6;
const DEBOUNCE_MS = 300;

export function useMenuCatalogueSuggestions(query: string, locale: LanguageCode) {
  const [templates, setTemplates] = useState<CatalogueTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const sequence = useRef(0);
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      setTemplates([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setTemplates([]);
    setError(null);
    setIsLoading(true);
    const controller = new AbortController();
    const requestNumber = ++sequence.current;
    const timer = window.setTimeout(() => {
      void Promise.all(
        (['item', 'bundle'] as const).map((type) =>
          listCatalogueTemplates({ type, q: normalizedQuery, locale, limit: REQUEST_LIMIT }, controller.signal),
        ),
      )
        .then((pages) => {
          if (controller.signal.aborted || sequence.current !== requestNumber) return;
          const merged = pages.flatMap((page) => page.items);
          const unique = new Map(merged.map((template) => [`${template.templateId}@${template.revision}`, template]));
          setTemplates([...unique.values()]);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || sequence.current !== requestNumber) return;
          setTemplates([]);
          setError(serverMessage(reason) ?? 'catalogue_load_error');
        })
        .finally(() => {
          if (!controller.signal.aborted && sequence.current === requestNumber) setIsLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      sequence.current += 1;
      controller.abort();
    };
  }, [locale, normalizedQuery, retryVersion]);

  return {
    templates,
    isLoading,
    error,
    retry: () => setRetryVersion((current) => current + 1),
    isVisible: normalizedQuery.length >= MIN_QUERY_LENGTH,
  };
}
