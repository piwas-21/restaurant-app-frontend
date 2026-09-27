'use client';

import { useCallback, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { loadTranslationSuggestionBatch } from '@/components/admin/product-editor/translations/translationReviewBatch';
import {
  fieldReferenceKey,
  type TranslationReviewField,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import type { LanguageCode } from '@/config/languageConfig';
import type {
  TranslationFieldRef,
  TranslationFieldStatus,
  TranslationWorkbenchAdapter,
} from '@/services/translationWorkbenchService';
import type { TranslationSuggestionEntry } from './useTranslationSuggestionBatch';

interface Options {
  readonly adapter: TranslationWorkbenchAdapter;
  readonly readFields: () => TranslationReviewField[];
  readonly loadKey: MutableRefObject<string | null>;
  readonly setPhase: Dispatch<SetStateAction<'idle' | 'loading' | 'ready' | 'error'>>;
  readonly setEntries: Dispatch<SetStateAction<TranslationSuggestionEntry[]>>;
  readonly setProviderStatus: Dispatch<SetStateAction<'disabled' | 'ready' | null>>;
  readonly setPreviewRows: Dispatch<SetStateAction<TranslationFieldStatus[]>>;
  readonly setError: Dispatch<SetStateAction<boolean>>;
}

export function useTranslationAlternativeSuggestion({
  adapter,
  readFields,
  loadKey,
  setPhase,
  setEntries,
  setProviderStatus,
  setPreviewRows,
  setError,
}: Options) {
  const requestId = useRef(0);
  return useCallback(
    async (fieldRef: TranslationFieldRef, locale: LanguageCode) => {
      const requestKey = loadKey.current;
      const field = readFields().find(
        (candidate) =>
          candidate.sourceLocaleKnown && fieldReferenceKey(candidate.input.fieldRef) === fieldReferenceKey(fieldRef),
      );
      if (!requestKey || !field) return;

      const currentRequestId = ++requestId.current;
      setPhase('loading');
      setError(false);
      try {
        const result = await loadTranslationSuggestionBatch([field.input], adapter, 'explicitAlternative', [locale]);
        if (loadKey.current !== requestKey || requestId.current !== currentRequestId || !result.preview) return;

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
        if (loadKey.current !== requestKey || requestId.current !== currentRequestId) return;
        setError(true);
        setPhase('error');
      }
    },
    [adapter, loadKey, readFields, setEntries, setError, setPhase, setPreviewRows, setProviderStatus],
  );
}
