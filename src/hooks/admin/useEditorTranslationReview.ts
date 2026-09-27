'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import type { useProductEditorForm } from './useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import {
  applyReviewedTranslations,
  buildTranslationReviewFields,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import type { TranslationDecision, TranslationWorkbenchAdapter } from '@/services/translationWorkbenchService';
import { translationWorkbenchService } from '@/services/translationWorkbenchService';
import { useTranslationSuggestionBatch } from './useTranslationSuggestionBatch';
import type { TranslationSlot } from '@/components/admin/product-editor/translations/translationSlots';
import { createTranslationMetadataPatch } from '@/components/admin/product-editor/translations/translationReviewMetadata';
import { buildReviewedTranslationOutcome } from '@/components/admin/product-editor/translations/reviewedTranslationOutcome';

type Editor = ReturnType<typeof useProductEditorForm>;

interface UseEditorTranslationReviewOptions {
  readonly editor: Editor;
  readonly productId: string;
  readonly product: ProductDetails;
  readonly isOpen: boolean;
  readonly adapter?: TranslationWorkbenchAdapter;
}

const validLocale = (value: string): LanguageCode =>
  LANGUAGE_CODES.includes(value as LanguageCode) ? (value as LanguageCode) : 'en';

function persistedSourceLocale(product: ProductDetails, slot: TranslationSlot): string | undefined {
  const fieldKey = slot.ref.target === 'ingredient' ? 'name' : slot.ref.field;
  if (slot.ref.target === 'item') return product.translationMetadata?.sourceLocales?.[fieldKey];
  if (slot.ref.target === 'variation')
    return product.variations[slot.ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
  if (slot.ref.target === 'ingredient')
    return product.detailedIngredients?.[slot.ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
  return product.menuDefinition?.sections[slot.ref.index]?.translationMetadata?.sourceLocales?.[fieldKey];
}

export function useEditorTranslationReview({
  editor,
  productId,
  product,
  isOpen,
  adapter = translationWorkbenchService,
}: UseEditorTranslationReviewOptions) {
  const [sourceLocales, setSourceLocales] = useState<Readonly<Record<string, LanguageCode>>>({});
  const acceptedIdsRef = useRef<Readonly<Record<string, string>>>({});
  const [staleCount, setStaleCount] = useState(0);
  const [reviewWriteError, setReviewWriteError] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      setStaleCount(0);
      setReviewWriteError(false);
    }
  }, [isOpen]);

  const defaultLocale = validLocale(editor.currentLanguage);
  const editorForm = editor.form;
  const editorIngredients = editor.detailedIngredients;
  const editorMenuDefinition = editor.menuDefinition;
  const sourceLocaleFor = useCallback(
    (slotKey: string, slot?: TranslationSlot) =>
      sourceLocales[slotKey] ?? validLocale((slot && persistedSourceLocale(product, slot)) ?? defaultLocale),
    [defaultLocale, product, sourceLocales],
  );
  const setSourceLocaleFor = useCallback((slotKey: string, locale: string) => {
    setSourceLocales((current) => ({ ...current, [slotKey]: validLocale(locale) }));
  }, []);

  const readFields = useCallback(
    () =>
      buildTranslationReviewFields(
        { form: editorForm, detailedIngredients: editorIngredients, menuDefinition: editorMenuDefinition },
        productId,
        sourceLocaleFor,
      ),
    [editorForm, editorIngredients, editorMenuDefinition, productId, sourceLocaleFor],
  );
  const batch = useTranslationSuggestionBatch({ isOpen, readFields, adapter });
  const setBatchEntries = batch.setEntries;
  const setBatchError = batch.setError;
  const batchEntries = batch.entries;
  const requestedBatchFields = batch.requestedFields;
  const previewRows = batch.previewRows;

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
    () => createTranslationMetadataPatch(readFields(), acceptedIdsRef.current),
    [readFields],
  );

  const submitDecisions = useCallback(async (): Promise<boolean> => {
    const selected = batchEntries.filter((entry) => entry.decision !== 'pending');
    if (selected.length === 0) return true;

    try {
      setReviewWriteError(false);
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
      void reviewError;
      setBatchError(true);
      setReviewWriteError(true);
      return false;
    }
  }, [adapter, batchEntries, editor, previewRows, readFields, requestedBatchFields, setBatchError]);

  return {
    sourceLocales,
    sourceLocaleFor,
    setSourceLocaleFor,
    buildMetadataPatch,
    phase: batch.phase,
    entries: batch.entries,
    providerStatus: batch.providerStatus,
    pendingLocales: batch.pendingLocales,
    manualReviewCount: batch.manualReviewCount,
    error: batch.error,
    reviewWriteError,
    staleCount,
    decide,
    edit,
    acceptAll,
    suggestMissing: batch.suggestMissing,
    submitDecisions,
  };
}
