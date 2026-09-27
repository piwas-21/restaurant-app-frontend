'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { TranslationDecision, TranslationWorkbenchAdapter } from '@/services/translationWorkbenchService';
import type { TranslationOwnerMetadataWrite } from '@/types/translationMetadata';
import { buildReviewedTranslationOutcome } from '@/components/admin/product-editor/translations/reviewedTranslationOutcome';
import { localizedReferenceKey } from '@/components/admin/product-editor/translations/translationReviewMetadata';
import type {
  TranslationReviewField,
  ReviewedTextChange,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import { fieldReferenceKey } from '@/components/admin/product-editor/translations/translationReviewFields';
import type { useTranslationSuggestionBatch } from './useTranslationSuggestionBatch';

type Batch = ReturnType<typeof useTranslationSuggestionBatch>;

interface Options {
  readonly isOpen: boolean;
  readonly batch: Batch;
  readonly readFields: () => TranslationReviewField[];
  readonly expectedContentVersion?: string;
  readonly onApply: (changes: readonly ReviewedTextChange[]) => void;
  readonly adapter: TranslationWorkbenchAdapter;
}

function sourceFingerprint(field: TranslationReviewField): string {
  return JSON.stringify([field.input.sourceLocale, field.input.sourceText, field.input.context ?? null]);
}

export function useLocalizedOwnerReviewDecisions({
  isOpen,
  batch,
  readFields,
  expectedContentVersion,
  onApply,
  adapter,
}: Options) {
  const acceptedIdsRef = useRef<Readonly<Record<string, string>>>({});
  const acceptedSourcesRef = useRef<Readonly<Record<string, string>>>({});
  const [staleCount, setStaleCount] = useState(0);
  const [reviewWriteError, setReviewWriteError] = useState(false);
  const entries = batch.entries;
  const setEntries = batch.setEntries;
  const requestedFields = batch.requestedFields;
  const previewRows = batch.previewRows;
  const setBatchError = batch.setError;

  const decide = useCallback(
    (suggestionId: string, decision: TranslationDecision['decision']) => {
      const decisionState = { accept: 'accepted', edit: 'edited', reject: 'rejected' } as const;
      setEntries((current) =>
        current.map((entry) =>
          entry.suggestion.suggestionId === suggestionId
            ? {
                ...entry,
                decision: decisionState[decision],
                text: decision === 'accept' ? entry.suggestion.text : entry.text,
              }
            : entry,
        ),
      );
    },
    [setEntries],
  );
  const edit = useCallback(
    (suggestionId: string, text: string) => {
      setEntries((current) =>
        current.map((entry) =>
          entry.suggestion.suggestionId === suggestionId
            ? { ...entry, text, decision: text === entry.suggestion.text ? 'pending' : 'edited' }
            : entry,
        ),
      );
    },
    [setEntries],
  );
  const acceptAll = useCallback(() => {
    setEntries((current) =>
      current.map((entry) =>
        entry.decision === 'pending' ? { ...entry, decision: 'accepted', text: entry.suggestion.text } : entry,
      ),
    );
  }, [setEntries]);

  const buildMetadataPatch = useCallback((): TranslationOwnerMetadataWrite => {
    const sourceLocales: Record<string, string> = {};
    const acceptedSuggestionIds: Record<string, string> = {};
    for (const field of readFields()) {
      if (!field.sourceLocaleKnown) continue;
      const { input } = field;
      const fieldKey = input.fieldRef.fieldKey;
      sourceLocales[fieldKey] = input.sourceLocale;
      for (const locale of LANGUAGE_CODES) {
        const key = localizedReferenceKey(input.fieldRef, locale);
        const suggestionId = acceptedIdsRef.current[key];
        if (suggestionId && acceptedSourcesRef.current[key] === sourceFingerprint(field)) {
          acceptedSuggestionIds[`${fieldKey}.${locale}`] = suggestionId;
        }
      }
    }
    return {
      sourceLocales,
      acceptedSuggestionIds,
      ...(expectedContentVersion ? { expectedContentVersion } : {}),
    };
  }, [expectedContentVersion, readFields]);

  const submitDecisions = useCallback(async (): Promise<boolean> => {
    const selected = entries.filter((entry) => entry.decision !== 'pending');
    if (selected.length === 0) return true;
    try {
      setReviewWriteError(false);
      const decisions: TranslationDecision[] = selected.map((entry) => ({
        suggestionId: entry.suggestion.suggestionId,
        decision: entry.decision === 'accepted' ? 'accept' : entry.decision === 'edited' ? 'edit' : 'reject',
        ...(entry.decision === 'edited' ? { text: entry.text } : {}),
      }));
      const response = await adapter.review(decisions);
      const currentFields = readFields();
      const outcome = buildReviewedTranslationOutcome({
        decisions: response.decisions,
        selected,
        requestedFields: requestedFields.current,
        currentFields,
        previewRows,
        acceptedIds: acceptedIdsRef.current,
      });
      onApply(outcome.changes);
      acceptedIdsRef.current = outcome.acceptedIds;
      const sources: Record<string, string> = {};
      for (const change of outcome.changes) {
        const key = localizedReferenceKey(change.fieldRef, change.locale);
        const field = currentFields.find(
          (candidate) => fieldReferenceKey(candidate.input.fieldRef) === fieldReferenceKey(change.fieldRef),
        );
        if (field && outcome.acceptedIds[key]) sources[key] = sourceFingerprint(field);
      }
      acceptedSourcesRef.current = { ...acceptedSourcesRef.current, ...sources };
      setStaleCount(outcome.staleCount);
      return true;
    } catch (error) {
      void error;
      setBatchError(true);
      setReviewWriteError(true);
      return false;
    }
  }, [adapter, entries, onApply, previewRows, readFields, requestedFields, setBatchError]);

  const clearAcceptedSuggestionIds = useCallback(() => {
    acceptedIdsRef.current = {};
    acceptedSourcesRef.current = {};
  }, []);
  useEffect(() => {
    if (isOpen) return;
    setStaleCount(0);
    setReviewWriteError(false);
  }, [isOpen]);

  return {
    decide,
    edit,
    acceptAll,
    submitDecisions,
    buildMetadataPatch,
    clearAcceptedSuggestionIds,
    staleCount,
    error: reviewWriteError,
  };
}
