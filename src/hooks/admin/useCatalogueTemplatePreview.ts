'use client';

import { useEffect, useState } from 'react';
import type { CatalogueTemplateRevision, CatalogueTemplateSummary } from '@/services/catalogueTemplateService';
import { getCatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import { serverMessage } from '@/utils/apiFormErrors';

export function catalogueReferenceKey(templateId: string, revision: number): string {
  return `${templateId}@${revision}`;
}

export function useCatalogueTemplatePreview(template: CatalogueTemplateSummary | null) {
  const [detail, setDetail] = useState<CatalogueTemplateRevision | null>(null);
  const [dependencyDetails, setDependencyDetails] = useState<Record<string, CatalogueTemplateRevision>>({});
  const [unresolvedDependencyCount, setUnresolvedDependencyCount] = useState(0);
  const [dependencyErrorMessage, setDependencyErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!template) {
      setDetail(null);
      setDependencyDetails({});
      setUnresolvedDependencyCount(0);
      setDependencyErrorMessage(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let current = true;
    setIsLoading(true);
    setError(null);
    setDetail(null);
    setDependencyDetails({});
    setUnresolvedDependencyCount(0);
    setDependencyErrorMessage(null);

    void getCatalogueTemplateRevision(template.templateId, template.revision, controller.signal)
      .then(async (result) => {
        if (!current) return;
        setDetail(result);
        const dependencies = result.dependencies.slice(0, 24);
        const resolved: Record<string, CatalogueTemplateRevision> = {};
        let unresolvedCount = 0;
        let firstDependencyError: string | null = null;
        let nextIndex = 0;
        const worker = async () => {
          while (nextIndex < dependencies.length) {
            const dependency = dependencies[nextIndex];
            nextIndex += 1;
            try {
              const value = await getCatalogueTemplateRevision(
                dependency.templateId,
                dependency.revision,
                controller.signal,
              );
              if (current) resolved[catalogueReferenceKey(dependency.templateId, dependency.revision)] = value;
            } catch (reason: unknown) {
              if (controller.signal.aborted) return;
              firstDependencyError ??= serverMessage(reason);
              unresolvedCount += 1;
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, dependencies.length) }, () => worker()));
        if (current) setDependencyDetails(resolved);
        if (current) setUnresolvedDependencyCount(unresolvedCount);
        if (current) setDependencyErrorMessage(firstDependencyError);
      })
      .catch((reason: unknown) => {
        if (current && !controller.signal.aborted) setError(serverMessage(reason) ?? '');
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryKey, template]);

  return {
    detail,
    dependencyDetails,
    unresolvedDependencyCount,
    dependencyErrorMessage,
    isLoading,
    error,
    retry: () => setRetryKey((value) => value + 1),
  };
}
