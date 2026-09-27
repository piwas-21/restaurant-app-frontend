'use client';

import { useCallback } from 'react';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import type { TranslationFieldRef, TranslationWorkbenchAdapter } from '@/services/translationWorkbenchService';
import { translationWorkbenchService } from '@/services/translationWorkbenchService';
import type { TranslationFieldLabel } from '@/components/admin/product-editor/translations/translationSlots';
import type {
  TranslationReviewField,
  ReviewedTextChange,
} from '@/components/admin/product-editor/translations/translationReviewFields';
import { useTranslationSuggestionBatch } from './useTranslationSuggestionBatch';
import { useLocalizedOwnerReviewDecisions } from './useLocalizedOwnerReviewDecisions';

export type LocalizedOwnerType = 'category' | 'optionSet';

export interface LocalizedOwnerReviewField {
  readonly fieldKey: 'name' | 'description';
  readonly fieldLabel: TranslationFieldLabel;
  readonly sourceText: string;
  readonly translations: Readonly<Partial<Record<LanguageCode, string | null | undefined>>>;
}

interface Options {
  readonly isOpen: boolean;
  readonly entityType: LocalizedOwnerType;
  readonly entityId?: string;
  readonly clientKey: string;
  readonly sourceLocale?: string | null;
  readonly fields: readonly LocalizedOwnerReviewField[];
  readonly expectedContentVersion?: string;
  readonly onApply: (changes: readonly ReviewedTextChange[]) => void;
  readonly adapter?: TranslationWorkbenchAdapter;
}

function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value && LANGUAGE_CODES.includes(value as LanguageCode));
}

function sourceOnlyRefreshKey(fields: readonly TranslationReviewField[]): string {
  return JSON.stringify(
    fields.map(({ input }) => ({
      fieldRef: input.fieldRef,
      sourceLocale: input.sourceLocale,
      sourceText: input.sourceText,
      context: input.context,
    })),
  );
}

export function useLocalizedOwnerTranslationReview({
  isOpen,
  entityType,
  entityId,
  clientKey,
  sourceLocale,
  fields,
  expectedContentVersion,
  onApply,
  adapter = translationWorkbenchService,
}: Options) {
  const readFields = useCallback((): TranslationReviewField[] => {
    const knownLocale = isLanguageCode(sourceLocale);
    return fields
      .filter((field) => field.sourceText.trim().length > 0)
      .map((field) => {
        const fieldRef: TranslationFieldRef = {
          entityType,
          ...(entityId ? { entityId } : { clientKey }),
          fieldKey: field.fieldKey,
        };
        const targets = LANGUAGE_CODES.reduce(
          (current, locale) => ({ ...current, [locale]: field.translations[locale] ?? '' }),
          {} as Record<LanguageCode, string>,
        );
        const existingTranslations: Record<string, string> = {};
        for (const [locale, text] of Object.entries(field.translations)) {
          if (typeof text === 'string' && text.trim()) existingTranslations[locale] = text;
        }
        return {
          input: {
            fieldRef,
            // Unknown legacy source locales stay out of workbench requests.
            sourceLocale: knownLocale ? sourceLocale : 'en',
            sourceText: field.sourceText,
            targetTexts: targets,
            context: null,
          },
          slot: {
            key: `${entityType}:${field.fieldKey}`,
            fieldLabel: field.fieldLabel,
            source: field.sourceText,
            translations: existingTranslations,
          },
          sourceLocaleKnown: knownLocale,
        };
      });
  }, [clientKey, entityId, entityType, fields, sourceLocale]);
  const refreshKey = useCallback(sourceOnlyRefreshKey, []);
  const batch = useTranslationSuggestionBatch({ isOpen, readFields, adapter, refreshKey });
  const actions = useLocalizedOwnerReviewDecisions({
    isOpen,
    batch,
    readFields,
    expectedContentVersion,
    onApply,
    adapter,
  });
  const setSourceLocaleFor = useCallback((_slotKey: string, _locale: string): void => {}, []);
  const { error: actionError, staleCount, ...reviewActions } = actions;
  return {
    ...reviewActions,
    phase: batch.phase,
    entries: batch.entries,
    providerStatus: batch.providerStatus,
    pendingLocales: batch.pendingLocales,
    manualReviewCount: batch.manualReviewCount,
    errorMessage: batch.errorMessage,
    alternativeTargets: batch.alternativeTargets,
    error: batch.error || actionError,
    staleCount,
    unknownSourceLocaleFields: readFields().filter((field) => !field.sourceLocaleKnown),
    suggestAlternative: batch.suggestAlternative,
    suggestMissing: batch.suggestMissing,
    setSourceLocaleFor,
  };
}
