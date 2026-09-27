import type {
  TranslationFieldInput,
  TranslationFieldStatus,
  TranslationGenerationIntent,
  TranslationDecision,
  TranslationPreviewResponse,
  TranslationSuggestionsResponse,
  TranslationWorkbenchAdapter,
  TranslationWorkbenchRequest,
} from '@/services/translationWorkbenchService';
import { LANGUAGE_CODES } from '@/config/languageConfig';

export interface TranslationSuggestionBatch {
  readonly preview: TranslationPreviewResponse | null;
  readonly suggestions: TranslationSuggestionsResponse | null;
}

export function translationDecisionFor(decision: 'accepted' | 'edited' | 'rejected'): TranslationDecision['decision'] {
  switch (decision) {
    case 'accepted':
      return 'accept';
    case 'edited':
      return 'edit';
    case 'rejected':
      return 'reject';
  }
}

const fieldKey = (field: TranslationFieldInput): string =>
  [
    field.fieldRef.entityType,
    field.fieldRef.entityId ?? '',
    field.fieldRef.clientKey ?? '',
    field.fieldRef.fieldKey,
  ].join('|');

function uniqueFields(fields: readonly TranslationFieldInput[]): TranslationFieldInput[] {
  const unique = new Map<string, TranslationFieldInput>();
  for (const field of fields) unique.set(fieldKey(field), field);
  return [...unique.values()];
}

function shouldSuggestOnSave(field: TranslationFieldInput, row: TranslationFieldStatus): boolean {
  if (field.fieldRef.clientKey) return true;
  if (row.targets.some((target) => target.status === 'stale')) return true;
  const sourceTarget = row.targets.find((target) => target.locale === field.sourceLocale);
  if (sourceTarget?.provenance?.kind === 'template') return true;
  return Boolean(sourceTarget?.provenance?.sourceHash && sourceTarget.provenance.sourceHash !== row.sourceHash);
}

function hasReviewableGap(row: TranslationFieldStatus): boolean {
  return row.targets.some(
    (target) => target.status === 'missing' || target.status === 'stale' || target.status === 'sourceCopy',
  );
}

/** Preview every field once, then ask for suggestions only on an eligible save or explicit fill. */
export async function loadTranslationSuggestionBatch(
  fields: readonly TranslationFieldInput[],
  adapter: TranslationWorkbenchAdapter,
  generationIntent: TranslationGenerationIntent = 'saveReview',
  targetLocales: readonly (typeof LANGUAGE_CODES)[number][] = LANGUAGE_CODES,
): Promise<TranslationSuggestionBatch> {
  const candidates = uniqueFields(fields);
  if (candidates.length === 0) return { preview: null, suggestions: null };

  const request: TranslationWorkbenchRequest = {
    generationIntent,
    targetLocales,
    fields: candidates,
  };
  const preview = await adapter.preview(request);
  const byField = new Map(
    preview.rows.map((row) => [
      [row.fieldRef.entityType, row.fieldRef.entityId ?? '', row.fieldRef.clientKey ?? '', row.fieldRef.fieldKey].join(
        '|',
      ),
      row,
    ]),
  );
  const eligible = candidates.filter((field) => {
    const row = byField.get(fieldKey(field));
    if (!row) return false;
    switch (generationIntent) {
      case 'explicitAlternative':
        return row.targets.some(
          (target) =>
            targetLocales.includes(target.locale) &&
            target.locale !== row.sourceLocale &&
            Boolean(target.text?.trim()) &&
            (target.provenance?.kind === 'manual' || target.provenance?.kind === 'legacyUnknown'),
        );
      case 'explicitFill':
        return hasReviewableGap(row);
      case 'saveReview':
        return hasReviewableGap(row) && shouldSuggestOnSave(field, row);
    }
  });
  if (eligible.length === 0) return { preview, suggestions: null };

  return {
    preview,
    suggestions: await adapter.suggest({ ...request, fields: eligible }),
  };
}
