'use client';

import { useEffect, useState } from 'react';
import type { LanguageCode } from '@/config/languageConfig';
import { getCatalogueTemplateRevision, resolveCatalogueTemplateText } from '@/services/catalogueTemplateService';
import type { CatalogueTemplateOptionReference } from '@/services/catalogueTemplateService';
import type { CatalogueImportSessionItem } from '@/services/catalogueImportService';

export interface CatalogueOptionPriceRef {
  readonly key: string;
  readonly name: string;
}

const refKey = (templateId: string, revision: number) => `${templateId}@${revision}`;
const MAX_DETAILS = 80;
const DETAIL_CONCURRENCY = 4;

async function readDetails(items: readonly CatalogueImportSessionItem[], signal: AbortSignal) {
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

export function useCatalogueOptionPrices(items: readonly CatalogueImportSessionItem[], locale: LanguageCode) {
  const signature = items
    .map((item) => refKey(item.templateId, item.revision))
    .sort((left, right) => left.localeCompare(right))
    .join('|');
  const [byOwner, setByOwner] = useState<Record<string, CatalogueOptionPriceRef[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<'failed' | 'tooMany' | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (items.length === 0) {
      setByOwner({});
      setError(null);
      setIsLoading(false);
      return () => controller.abort();
    }
    if (items.length > MAX_DETAILS) {
      setByOwner({});
      setError('tooMany');
      setIsLoading(false);
      return () => controller.abort();
    }
    const load = async () => {
      setIsLoading(true);
      setByOwner({});
      setError(null);
      const ownerItems = items;
      const loaded = await readDetails(ownerItems, controller.signal);
      if (controller.signal.aborted) return;
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
      const missing = [
        ...new Map([...refsByOwner.values()].flat().map((ref) => [refKey(ref.templateId, ref.revision), ref])).values(),
      ].filter((ref) => !names.has(refKey(ref.templateId, ref.revision)));
      if (ownerItems.length + missing.length > MAX_DETAILS) {
        setByOwner({});
        setError('tooMany');
        setIsLoading(false);
        return;
      }
      let failed = loaded.failed;
      if (missing.length > 0) {
        const extraItems = missing.map(
          (ref) => ({ templateId: ref.templateId, revision: ref.revision }) as CatalogueImportSessionItem,
        );
        const extra = await readDetails(extraItems, controller.signal);
        failed ||= extra.failed;
        extra.details.forEach((detail) =>
          names.set(refKey(detail.templateId, detail.revision), resolveCatalogueTemplateText(detail, locale).name),
        );
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
      setError(failed ? 'failed' : null);
      setIsLoading(false);
    };
    void load().catch(() => {
      if (!controller.signal.aborted) {
        setByOwner({});
        setError('failed');
        setIsLoading(false);
      }
    });
    return () => controller.abort();
    // The signature represents the selected exact template revisions, not mutable decision rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, locale, retryVersion]);

  return { byOwner, isLoading, error, retry: () => setRetryVersion((current) => current + 1) };
}
