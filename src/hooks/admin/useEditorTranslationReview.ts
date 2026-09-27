'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { useProductEditorForm } from './useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import {
  applyReviewedTranslations,
  buildTranslationReviewFields,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import type { TranslationDecision, TranslationWorkbenchAdapter } from '@/services/translationWorkbenchService';
import { translationWorkbenchService } from '@/services/translationWorkbenchService';
import { getErrorMessage } from '@/utils/apiClient';
import { useTranslationSuggestionBatch, type TranslationSuggestionEntry } from './useTranslationSuggestionBatch';
import { createTranslationMetadataPatch } from '@/components/admin/product-editor/translations/translationReviewMetadata';
import { buildReviewedTranslationOutcome } from '@/components/admin/product-editor/translations/reviewedTranslationOutcome';
import { useEditorSourceLocales } from './useEditorSourceLocales';

type Editor = ReturnType<typeof useProductEditorForm>;

interface UseEditorTranslationReviewOptions {
  readonly editor: Editor;
  readonly productId: string;
  readonly product: ProductDetails;
  readonly isOpen: boolean;
  readonly adapter?: TranslationWorkbenchAdapter;
}

type ReviewedDecision = Exclude<TranslationSuggestionEntry['decision'], 'pending'>;
type ReviewedEntry = TranslationSuggestionEntry & { readonly decision: ReviewedDecision };

export function useEditorTranslationReview({
  editor,
  productId,
  product,
  isOpen,
  adapter = translationWorkbenchService,
}: UseEditorTranslationReviewOptions) {
  const { sourceLocaleFor, sourceLocaleKnownFor, setSourceLocaleFor } = useEditorSourceLocales({
    editor,
    product,
    productId,
  });
  const acceptedIdsRef = useRef<Readonly<Record<string, string>>>({});
  const [staleCount, setStaleCount] = useState(0);
  const [reviewWriteError, setReviewWriteError] = useState(false);
  const [reviewWriteErrorMessage, setReviewWriteErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    if (isOpen) return;
    setStaleCount(0);
    setReviewWriteError(false);
    setReviewWriteErrorMessage(null);
  }, [isOpen]);
  const editorForm = editor.form,
    editorVariationFields = editor.variations.fields,
    editorIngredients = editor.detailedIngredients;
  const editorMenuDefinition = editor.menuDefinition,
    editorCategories = editor.categories,
    primaryCategoryId = editor.primaryCategoryId;

  const readFields = useCallback(
    () =>
      buildTranslationReviewFields(
        {
          form: editorForm,
          variations: { fields: editorVariationFields },
          detailedIngredients: editorIngredients,
          menuDefinition: editorMenuDefinition,
          categories: editorCategories,
          primaryCategoryId,
        },
        productId,
        sourceLocaleFor,
        sourceLocaleKnownFor,
      ),
    [
      editorForm,
      editorVariationFields,
      editorIngredients,
      editorMenuDefinition,
      editorCategories,
      primaryCategoryId,
      productId,
      sourceLocaleFor,
      sourceLocaleKnownFor,
    ],
  );
  const batch = useTranslationSuggestionBatch({ isOpen, readFields, adapter });
  const setBatchEntries = batch.setEntries,
    setBatchError = batch.setError;
  const batchEntries = batch.entries,
    requestedBatchFields = batch.requestedFields,
    previewRows = batch.previewRows;

  const decide = useCallback(
    (suggestionId: string, decision: TranslationDecision['decision']) => {
      const UI_DECISION = { accept: 'accepted', edit: 'edited', reject: 'rejected' } as const;
      setBatchEntries((current) =>
        current.map((entry) =>
          entry.suggestion.suggestionId === suggestionId
            ? {
                ...entry,
                decision: UI_DECISION[decision],
                text: decision === 'accept' ? entry.suggestion.text : entry.text,
              }
            : entry,
        ),
      );
    },
    [setBatchEntries],
  );

  const edit = useCallback(
    (suggestionId: string, text: string) => {
      setBatchEntries((current) =>
        current.map((entry) =>
          entry.suggestion.suggestionId === suggestionId
            ? { ...entry, text, decision: text === entry.suggestion.text ? 'pending' : 'edited' }
            : entry,
        ),
      );
    },
    [setBatchEntries],
  );

  const acceptAll = useCallback(() => {
    setBatchEntries((current) =>
      current.map((entry) =>
        entry.decision !== 'pending' ? entry : { ...entry, decision: 'accepted', text: entry.suggestion.text },
      ),
    );
  }, [setBatchEntries]);

  const buildMetadataPatch = useCallback(
    () =>
      createTranslationMetadataPatch(
        readFields().filter((field) => field.sourceLocaleKnown),
        acceptedIdsRef.current,
      ),
    [readFields],
  );

  const unknownSourceLocaleFields = readFields().filter((field) => !field.sourceLocaleKnown);
  const submitDecisions = useCallback(async (): Promise<boolean> => {
    const selected = batchEntries.filter((entry) => entry.decision !== 'pending') as ReviewedEntry[];
    if (selected.length === 0) return true;

    try {
      setReviewWriteError(false);
      setReviewWriteErrorMessage(null);
      const decisions: TranslationDecision[] = selected.map((entry) => ({
        suggestionId: entry.suggestion.suggestionId,
        decision: entry.decision === 'accepted' ? 'accept' : entry.decision === 'edited' ? 'edit' : 'reject',
        ...(entry.decision === 'edited' ? { text: entry.text } : {}),
      }));
      const response = await adapter.review(decisions);
      const outcome = buildReviewedTranslationOutcome({
        decisions: response.decisions,
        selected,
        requestedFields: requestedBatchFields.current,
        currentFields: readFields(),
        previewRows,
        acceptedIds: acceptedIdsRef.current,
      });
      applyReviewedTranslations(editor, outcome.changes);
      acceptedIdsRef.current = outcome.acceptedIds;
      setStaleCount(outcome.staleCount);
      return true;
    } catch (reviewError) {
      setReviewWriteErrorMessage(getErrorMessage(reviewError));
      setBatchError(true);
      setReviewWriteError(true);
      return false;
    }
  }, [adapter, batchEntries, editor, previewRows, readFields, requestedBatchFields, setBatchError]);

  return {
    sourceLocaleFor,
    sourceLocaleKnownFor,
    setSourceLocaleFor,
    unknownSourceLocaleFields,
    buildMetadataPatch,
    phase: batch.phase,
    entries: batch.entries,
    providerStatus: batch.providerStatus,
    pendingLocales: batch.pendingLocales,
    manualReviewCount: batch.manualReviewCount,
    error: batch.error,
    errorMessage: batch.errorMessage,
    reviewWriteError,
    reviewWriteErrorMessage,
    staleCount,
    decide,
    edit,
    acceptAll,
    suggestMissing: batch.suggestMissing,
    suggestAlternative: batch.suggestAlternative,
    alternativeTargets: batch.alternativeTargets,
    submitDecisions,
  };
}
