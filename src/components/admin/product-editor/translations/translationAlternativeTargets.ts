import type { LanguageCode } from '@/config/languageConfig';
import type { TranslationFieldRef, TranslationFieldStatus } from '@/services/translationWorkbenchService';
import type { TranslationReviewField } from './translationReviewFields';
import { fieldReferenceKey } from './translationReviewFields';

export interface TranslationAlternativeTarget {
  readonly fieldRef: TranslationFieldRef;
  readonly locale: LanguageCode;
  readonly text: string;
  readonly sourceText: string;
  readonly fieldLabel: string;
}

interface ExistingSuggestion {
  readonly suggestion: { readonly fieldRef: TranslationFieldRef; readonly locale: LanguageCode };
}

export function buildTranslationAlternativeTargets(
  previewRows: readonly TranslationFieldStatus[],
  requestedFields: readonly TranslationReviewField[],
  entries: readonly ExistingSuggestion[],
): TranslationAlternativeTarget[] {
  const existingSuggestions = new Set(
    entries.map((entry) => `${fieldReferenceKey(entry.suggestion.fieldRef)}|${entry.suggestion.locale}`),
  );

  return previewRows.flatMap((row) => {
    const field = requestedFields.find(
      (candidate) => fieldReferenceKey(candidate.input.fieldRef) === fieldReferenceKey(row.fieldRef),
    );
    if (!field) return [];

    return row.targets.flatMap((target) => {
      const key = `${fieldReferenceKey(row.fieldRef)}|${target.locale}`;
      if (
        !target.text?.trim() ||
        target.locale === row.sourceLocale ||
        existingSuggestions.has(key) ||
        (target.provenance?.kind !== 'manual' && target.provenance?.kind !== 'legacyUnknown')
      ) {
        return [];
      }
      return [
        {
          fieldRef: row.fieldRef,
          locale: target.locale,
          text: target.text,
          sourceText: field.slot.source,
          fieldLabel: field.slot.fieldLabel,
        },
      ];
    });
  });
}
