'use client';

import { useEffect, useState } from 'react';
import type { LanguageCode } from '@/config/languageConfig';
import { getCatalogueTemplateRevision, resolveCatalogueTemplateText } from '@/services/catalogueTemplateService';
import type { CatalogueTemplateOptionReference, CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import type { CatalogueImportSessionItem } from '@/services/catalogueImportService';

export interface CatalogueOptionPriceRef {
  readonly key: string;
  readonly name: string;
}

const refKey = (templateId: string, revision: number) => `${templateId}@${revision}`;
const MAX_DETAILS = 80;
const DETAIL_CONCURRENCY = 4;

async function readDetails(
  items: readonly Pick<CatalogueImportSessionItem, 'templateId' | 'revision'>[],
  signal: AbortSignal,
) {
  const details: Awaited<ReturnType<typeof getCatalogueTemplateRevision>>[] = [];
  for (let index = 0; index < items.length; index += DETAIL_CONCURRENCY) {
    const batch = items.slice(index, index + DETAIL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((item) => getCatalogueTemplateRevision(item.templateId, item.revision, signal)),
    );
    if (signal.aborted) return { details, failed: false };
    results.forEach((result) => (result.status === 'fulfilled' ? details.push(result.value) : undefined));
    if (results.some((result) => result.status === 'rejected')) return { details, failed: true };
  }
  return { details, failed: false };
}

function optionRefs(
  detail: Awaited<ReturnType<typeof getCatalogueTemplateRevision>>,
): CatalogueTemplateOptionReference[] {
  if (detail.type === 'bundle') return detail.payload.sections.flatMap((section) => section.options);
  if (detail.type === 'option-set') return detail.payload.options;
  return [];
}

function previewRefs(detail: CatalogueTemplateRevision): CatalogueTemplateOptionReference[] {
  if (detail.type === 'item') {
    return [...detail.payload.optionSets, ...detail.payload.sideSets].map((reference) => ({
      ...reference,
      sortOrder: 0,
    }));
  }
  return optionRefs(detail);
}

export function useCatalogueOptionPrices(items: readonly CatalogueImportSessionItem[], locale: LanguageCode) {
  const signature = items
    .map((item) => refKey(item.templateId, item.revision))
    .sort((left, right) => left.localeCompare(right))
    .join('|');
  const [byOwner, setByOwner] = useState<Record<string, CatalogueOptionPriceRef[]>>({});
  const [detailsByKey, setDetailsByKey] = useState<Record<string, CatalogueTemplateRevision>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<'failed' | 'tooMany' | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (items.length === 0) {
      setByOwner({});
      setDetailsByKey({});
      setError(null);
      setIsLoading(false);
      return () => controller.abort();
    }
    if (items.length > MAX_DETAILS) {
      setByOwner({});
      setDetailsByKey({});
      setError('tooMany');
      setIsLoading(false);
      return () => controller.abort();
    }
    const load = async () => {
      setIsLoading(true);
      setByOwner({});
      setDetailsByKey({});
      setError(null);
      const ownerItems = items;
      const loaded = await readDetails(ownerItems, controller.signal);
      if (controller.signal.aborted) return;
      const details = new Map(loaded.details.map((detail) => [refKey(detail.templateId, detail.revision), detail]));
      const names = new Map<string, string>(
        ownerItems.map((item) => [refKey(item.templateId, item.revision), item.displayName]),
      );
      loaded.details.forEach((detail) =>
        names.set(refKey(detail.templateId, detail.revision), resolveCatalogueTemplateText(detail, locale).name),
      );
      const refsByOwner = new Map<string, CatalogueTemplateOptionReference[]>();
      loaded.details.forEach((detail) => {
        const refs = optionRefs(detail);
        if (refs.length > 0) refsByOwner.set(refKey(detail.templateId, detail.revision), refs);
      });
      let failed = loaded.failed;
      const attempted = new Set(details.keys());
      const referenceStages = [
        () => loaded.details.flatMap(previewRefs),
        () =>
          loaded.details
            .filter((detail) => detail.type === 'item')
            .flatMap((detail) => [...detail.payload.optionSets, ...detail.payload.sideSets])
            .map((ref) => details.get(refKey(ref.templateId, ref.revision)))
            .filter(
              (detail): detail is Extract<CatalogueTemplateRevision, { type: 'option-set' }> =>
                detail?.type === 'option-set',
            )
            .flatMap(optionRefs),
      ];
      for (const getRefs of referenceStages) {
        const missing = [
          ...new Map(getRefs().map((ref) => [refKey(ref.templateId, ref.revision), ref])).values(),
        ].filter((ref) => !attempted.has(refKey(ref.templateId, ref.revision)));
        if (missing.length === 0) continue;
        if (attempted.size + missing.length > MAX_DETAILS) {
          setByOwner({});
          setError('tooMany');
          setIsLoading(false);
          return;
        }
        missing.forEach((ref) => attempted.add(refKey(ref.templateId, ref.revision)));
        const extraItems = missing.map((ref) => ({
          templateId: ref.templateId,
          revision: ref.revision,
        }));
        const extra = await readDetails(extraItems, controller.signal);
        failed ||= extra.failed;
        extra.details.forEach((detail) => {
          details.set(refKey(detail.templateId, detail.revision), detail);
          names.set(refKey(detail.templateId, detail.revision), resolveCatalogueTemplateText(detail, locale).name);
        });
      }
      if (controller.signal.aborted) return;
      const priceRows = Object.fromEntries(
        [...refsByOwner].map(([owner, refs]) => [
          owner,
          [...new Map(refs.map((ref) => [refKey(ref.templateId, ref.revision), ref])).values()].map((ref) => ({
            key: refKey(ref.templateId, ref.revision),
            name: names.get(refKey(ref.templateId, ref.revision)) ?? refKey(ref.templateId, ref.revision),
          })),
        ]),
      );
      setByOwner(priceRows);
      setDetailsByKey(Object.fromEntries(details));
      setError(failed ? 'failed' : null);
      setIsLoading(false);
    };
    void load().catch(() => {
      if (!controller.signal.aborted) {
        setByOwner({});
        setDetailsByKey({});
        setError('failed');
        setIsLoading(false);
      }
    });
    return () => controller.abort();
    // The signature represents the selected exact template revisions, not mutable decision rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, locale, retryVersion]);

  return { byOwner, detailsByKey, isLoading, error, retry: () => setRetryVersion((current) => current + 1) };
}
