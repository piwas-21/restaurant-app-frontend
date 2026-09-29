'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { loadTranslationSuggestionBatch } from '@/components/admin/product-editor/translations/translationReviewBatch';
import {
  fieldReferenceKey,
  type TranslationReviewField,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import { buildTranslationAlternativeTargets } from '@/components/admin/product-editor/translations/translationAlternativeTargets';
import type {
  TranslationFieldStatus,
  TranslationGenerationIntent,
  TranslationProviderStatus,
  TranslationSuggestion,
  TranslationWorkbenchAdapter,
} from '@/services/translationWorkbenchService';
import { useTranslationAlternativeSuggestion } from './useTranslationAlternativeSuggestion';

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
  readonly refreshKey?: (fields: readonly TranslationReviewField[]) => string;
}

export function useTranslationSuggestionBatch({
  isOpen,
  readFields,
  adapter,
  refreshKey,
}: UseTranslationSuggestionBatchOptions) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [entries, setEntries] = useState<TranslationSuggestionEntry[]>([]);
  const [providerStatus, setProviderStatus] = useState<TranslationProviderStatus | null>(null);
  const [previewRows, setPreviewRows] = useState<TranslationFieldStatus[]>([]);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestedFields = useRef<TranslationReviewField[]>([]);
  const loadKey = useRef<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!isOpen || !adapter.availability) return;
    let active = true;
    void adapter
      .availability()
      .then((result) => {
        if (active) setProviderStatus(result.providerStatus);
      })
      .catch(() => {
        if (active) setProviderStatus('disabled');
      });
    return () => {
      active = false;
    };
  }, [isOpen, adapter]);

  const run = useCallback(
    async (fields: TranslationReviewField[], generationIntent: TranslationGenerationIntent, key: string) => {
      requestedFields.current = fields;
      setPhase(fields.length === 0 ? 'ready' : 'loading');
      setEntries([]);
      setError(false);
      setErrorMessage(null);
      if (fields.length === 0) return;
      try {
        const result = await loadTranslationSuggestionBatch(
          fields.map((field) => field.input),
          adapter,
          generationIntent,
        );
        if (loadKey.current !== key || !result.preview) return;
        setPreviewRows(result.preview.rows);
        if (result.suggestions) setProviderStatus(result.suggestions.providerStatus);
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
      } catch (requestError) {
        if (loadKey.current !== key) return;
        setErrorMessage(getErrorMessage(requestError));
        setError(true);
        setPhase('error');
      }
    },
    [adapter],
  );

  useEffect(() => {
    if (!isOpen) {
      if (!wasOpen.current) return;
      wasOpen.current = false;
      loadKey.current = null;
      setPhase('idle');
      setEntries([]);
      setPreviewRows([]);
      setProviderStatus(null);
      setError(false);
      setErrorMessage(null);
      return;
    }
    wasOpen.current = true;
    const fields = readFields().filter((field) => field.sourceLocaleKnown);
    const key = refreshKey ? refreshKey(fields) : JSON.stringify(fields.map((field) => field.input));
    if (loadKey.current === key) return;
    loadKey.current = key;
    void run(fields, 'saveReview', key);
  }, [isOpen, readFields, refreshKey, run]);

  const suggestMissing = useCallback(() => {
    const fields = readFields().filter((field) => field.sourceLocaleKnown);
    const key = `explicit:${JSON.stringify(fields.map((field) => field.input))}:${Date.now()}`;
    loadKey.current = key;
    void run(fields, 'explicitFill', key);
  }, [readFields, run]);

  const suggestAlternative = useTranslationAlternativeSuggestion({
    adapter,
    readFields,
    loadKey,
    setPhase,
    setEntries,
    setProviderStatus,
    setPreviewRows,
    setError,
    setErrorMessage,
  });

  const targets = previewRows.flatMap((row) => row.targets);
  const pendingLocales = targets.filter(
    (target) => target.status === 'missing' || target.status === 'stale' || target.status === 'sourceCopy',
  ).length;
  const manualReviewCount = targets.filter(
    (target) => target.status === 'sourceCopy' || target.provenance?.kind === 'legacyUnknown',
  ).length;
  const alternativeTargets = buildTranslationAlternativeTargets(previewRows, requestedFields.current, entries);
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
    errorMessage,
    setError,
    suggestMissing,
    suggestAlternative,
    alternativeTargets,
  };
}
