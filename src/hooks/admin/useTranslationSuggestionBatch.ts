'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { loadTranslationSuggestionBatch } from '@/components/admin/product-editor/translations/translationReviewBatch';
import {
  fieldReferenceKey,
  type TranslationReviewField,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import type { LanguageCode } from '@/config/languageConfig';
import { buildTranslationAlternativeTargets } from '@/components/admin/product-editor/translations/translationAlternativeTargets';
import type {
  TranslationFieldRef,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestedFields = useRef<TranslationReviewField[]>([]);
  const loadKey = useRef<string | null>(null);
  const alternativeRequestId = useRef(0);

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
      loadKey.current = null;
      setPhase('idle');
      setEntries([]);
      setPreviewRows([]);
      setProviderStatus(null);
      setError(false);
      setErrorMessage(null);
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

  const suggestAlternative = useCallback(
    async (fieldRef: TranslationFieldRef, locale: LanguageCode) => {
      const requestKey = loadKey.current;
      const field = readFields().find(
        (candidate) =>
          candidate.sourceLocaleKnown && fieldReferenceKey(candidate.input.fieldRef) === fieldReferenceKey(fieldRef),
      );
      if (!requestKey || !field) return;

      const requestId = ++alternativeRequestId.current;
      setPhase('loading');
      setError(false);
      try {
        const result = await loadTranslationSuggestionBatch([field.input], adapter, 'explicitAlternative', [locale]);
        if (loadKey.current !== requestKey || alternativeRequestId.current !== requestId || !result.preview) return;

        const key = fieldReferenceKey(field.input.fieldRef);
        const updatedRow = result.preview.rows.find((row) => fieldReferenceKey(row.fieldRef) === key);
        if (updatedRow) {
          setPreviewRows((current) =>
            current.map((row) => {
              if (fieldReferenceKey(row.fieldRef) !== key) return row;
              const latestTargets = new Map(updatedRow.targets.map((target) => [target.locale, target]));
              return {
                ...row,
                sourceHash: updatedRow.sourceHash,
                sourceText: updatedRow.sourceText,
                targets: row.targets.map((target) => latestTargets.get(target.locale) ?? target),
              };
            }),
          );
        }

        const suggestions = result.suggestions?.suggestions ?? [];
        setProviderStatus(result.suggestions?.providerStatus ?? null);
        setEntries((current) => {
          const existingIds = new Set(current.map((entry) => entry.suggestion.suggestionId));
          const added = suggestions
            .filter((suggestion) => !existingIds.has(suggestion.suggestionId))
            .map((suggestion) => ({
              suggestion,
              sourceText: field.slot.source,
              fieldLabel: field.slot.fieldLabel,
              decision: 'pending' as const,
              text: suggestion.text,
            }));
          return [...current, ...added];
        });
        setPhase('ready');
      } catch (requestError) {
        void requestError;
        if (loadKey.current !== requestKey || alternativeRequestId.current !== requestId) return;
        setError(true);
        setPhase('error');
      }
    },
    [adapter, readFields],
  );

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
