import type {
  TranslationFieldInput,
  TranslationFieldStatus,
  TranslationGenerationIntent,
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
): Promise<TranslationSuggestionBatch> {
  const candidates = uniqueFields(fields);
  if (candidates.length === 0) return { preview: null, suggestions: null };

  const request: TranslationWorkbenchRequest = {
    generationIntent,
    targetLocales: LANGUAGE_CODES,
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
  const eligible =
    generationIntent === 'explicitFill'
      ? candidates.filter((field) => {
          const row = byField.get(fieldKey(field));
          return row !== undefined && hasReviewableGap(row);
        })
      : candidates.filter((field) => {
          const row = byField.get(fieldKey(field));
          return row !== undefined && hasReviewableGap(row) && shouldSuggestOnSave(field, row);
        });
  if (eligible.length === 0) return { preview, suggestions: null };

  return {
    preview,
    suggestions: await adapter.suggest({ ...request, fields: eligible }),
  };
}
