'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTranslationSuggestionBatch } from '@/components/admin/product-editor/translations/translationReviewBatch';
import {
  fieldReferenceKey,
  type TranslationReviewField,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import type {
  TranslationFieldStatus,
  TranslationGenerationIntent,
  TranslationSuggestion,
  TranslationWorkbenchAdapter,
} from '@/services/translationWorkbenchService';

export interface TranslationSuggestionEntry {
  readonly suggestion: TranslationSuggestion;
  readonly sourceText: string;
  readonly fieldLabel: string;
  readonly decision: 'pending' | 'accepted' | 'edited' | 'rejected';
  readonly text: string;
}

interface UseTranslationSuggestionBatchOptions {
  readonly isOpen: boolean;
  readonly readFields: () => TranslationReviewField[];
  readonly adapter: TranslationWorkbenchAdapter;
}

export function useTranslationSuggestionBatch({ isOpen, readFields, adapter }: UseTranslationSuggestionBatchOptions) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [entries, setEntries] = useState<TranslationSuggestionEntry[]>([]);
  const [providerStatus, setProviderStatus] = useState<'disabled' | 'ready' | null>(null);
  const [previewRows, setPreviewRows] = useState<TranslationFieldStatus[]>([]);
  const [error, setError] = useState(false);
  const requestedFields = useRef<TranslationReviewField[]>([]);
  const loadKey = useRef<string | null>(null);

  const run = useCallback(
    async (fields: TranslationReviewField[], generationIntent: TranslationGenerationIntent, key: string) => {
      requestedFields.current = fields;
      setPhase(fields.length === 0 ? 'ready' : 'loading');
      setEntries([]);
      setError(false);
      if (fields.length === 0) return;
      try {
        const result = await loadTranslationSuggestionBatch(
          fields.map((field) => field.input),
          adapter,
          generationIntent,
        );
        if (loadKey.current !== key || !result.preview) return;
        setPreviewRows(result.preview.rows);
        setProviderStatus(result.suggestions?.providerStatus ?? null);
        setEntries(
          (result.suggestions?.suggestions ?? []).map((suggestion) => {
            const field = fields.find(
              (candidate) => fieldReferenceKey(candidate.input.fieldRef) === fieldReferenceKey(suggestion.fieldRef),
            );
            return {
              suggestion,
              sourceText: field?.slot.source ?? '',
              fieldLabel: field?.slot.fieldLabel ?? 'item_name',
              decision: 'pending',
              text: suggestion.text,
            };
          }),
        );
        setPhase('ready');
      } catch (_requestError) {
        /* Intentionally expose the review's generic error state without provider details. */
        if (loadKey.current !== key) return;
        setError(true);
        setPhase('error');
      }
    },
    [adapter],
  );

  useEffect(() => {
    if (!isOpen) {
      loadKey.current = null;
      setPhase('idle');
      setEntries([]);
      setPreviewRows([]);
      setProviderStatus(null);
      setError(false);
      return;
    }
    const fields = readFields().filter((field) => field.sourceLocaleKnown);
    const key = JSON.stringify(fields.map((field) => field.input));
    if (loadKey.current === key) return;
    loadKey.current = key;
    void run(fields, 'saveReview', key);
  }, [isOpen, readFields, run]);

  const suggestMissing = useCallback(() => {
    const fields = readFields().filter((field) => field.sourceLocaleKnown);
    const key = `explicit:${JSON.stringify(fields.map((field) => field.input))}:${Date.now()}`;
    loadKey.current = key;
    void run(fields, 'explicitFill', key);
  }, [readFields, run]);

  const targets = previewRows.flatMap((row) => row.targets);
  const pendingLocales = targets.filter(
    (target) => target.status === 'missing' || target.status === 'stale' || target.status === 'sourceCopy',
  ).length;
  const manualReviewCount = targets.filter(
    (target) => target.status === 'sourceCopy' || target.provenance?.kind === 'legacyUnknown',
  ).length;
  return {
    phase,
    entries,
    setEntries,
    providerStatus,
    previewRows,
    requestedFields,
    pendingLocales,
    manualReviewCount,
    error,
    setError,
    suggestMissing,
  };
}
