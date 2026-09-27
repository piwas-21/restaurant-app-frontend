import type { TranslationReviewField, ReviewedTextChange } from './translationReviewFields';
import { fieldReferenceKey } from './translationReviewFields';
import type { TranslationDecisionResult, TranslationFieldStatus } from '@/services/translationWorkbenchService';
import type { TranslationSuggestionEntry } from '@/hooks/admin/useTranslationSuggestionBatch';
import { localizedReferenceKey } from './translationReviewMetadata';

interface Inputs {
  readonly decisions: readonly TranslationDecisionResult[];
  readonly selected: readonly TranslationSuggestionEntry[];
  readonly requestedFields: readonly TranslationReviewField[];
  readonly currentFields: readonly TranslationReviewField[];
  readonly previewRows: readonly TranslationFieldStatus[];
  readonly acceptedIds: Readonly<Record<string, string>>;
}

export interface ReviewedTranslationOutcome {
  readonly changes: readonly ReviewedTextChange[];
  readonly acceptedIds: Readonly<Record<string, string>>;
  readonly staleCount: number;
}

function sourceStillCurrent(
  entry: TranslationSuggestionEntry,
  requestedFields: readonly TranslationReviewField[],
  currentFields: readonly TranslationReviewField[],
  previewRows: readonly TranslationFieldStatus[],
): boolean {
  const fieldKey = fieldReferenceKey(entry.suggestion.fieldRef);
  const snapshot = requestedFields.find((field) => fieldReferenceKey(field.input.fieldRef) === fieldKey);
  const current = currentFields.find((field) => fieldReferenceKey(field.input.fieldRef) === fieldKey);
  const preview = previewRows.find((row) => fieldReferenceKey(row.fieldRef) === fieldKey);
  const target = preview?.targets.find((candidate) => candidate.locale === entry.suggestion.locale);
  return Boolean(
    snapshot &&
    current &&
    preview &&
    target &&
    snapshot.input.sourceText === current.input.sourceText &&
    snapshot.input.sourceLocale === current.input.sourceLocale &&
    (snapshot.slot.translations[entry.suggestion.locale] ?? null) === (target.text ?? null) &&
    entry.suggestion.sourceHash === preview.sourceHash,
  );
}

export function buildReviewedTranslationOutcome(input: Inputs): ReviewedTranslationOutcome {
  const changes: ReviewedTextChange[] = [];
  const acceptedIds: Record<string, string> = { ...input.acceptedIds };
  let staleCount = 0;

  for (const result of input.decisions) {
    if (result.status === 'stale' || result.status === 'notFound') {
      staleCount += 1;
      continue;
    }
    if (result.status !== 'accepted' && result.status !== 'edited') continue;
    if (result.decision === 'reject') continue;

    const entry = input.selected.find((candidate) => candidate.suggestion.suggestionId === result.suggestionId);
    if (!entry) continue;
    if (!sourceStillCurrent(entry, input.requestedFields, input.currentFields, input.previewRows)) {
      staleCount += 1;
      continue;
    }

    const text = result.text ?? entry.text;
    if (!text.trim()) continue;
    changes.push({ fieldRef: entry.suggestion.fieldRef, locale: entry.suggestion.locale, text });
    acceptedIds[localizedReferenceKey(entry.suggestion.fieldRef, entry.suggestion.locale)] =
      entry.suggestion.suggestionId;
  }

  return { changes, acceptedIds, staleCount };
}
