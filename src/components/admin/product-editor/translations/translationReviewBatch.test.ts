import { loadTranslationSuggestionBatch } from './translationReviewBatch';
import type {
  TranslationFieldInput,
  TranslationFieldStatus,
  TranslationWorkbenchAdapter,
} from '@/services/translationWorkbenchService';

const field: TranslationFieldInput = {
  fieldRef: { entityType: 'product', entityId: 'product-1', fieldKey: 'name' },
  sourceLocale: 'tr',
  sourceText: 'Izgara köfte',
};

function status(input: TranslationFieldInput, statusCode: 'current' | 'missing' = 'current'): TranslationFieldStatus {
  return {
    fieldRef: input.fieldRef,
    sourceLocale: input.sourceLocale,
    sourceText: input.sourceText,
    sourceHash: 'source-hash',
    targets: [{ locale: 'fr', status: statusCode, text: statusCode === 'current' ? 'Boulettes grillées' : null }],
  };
}

function adapter(rows: TranslationFieldStatus[] = []): jest.Mocked<TranslationWorkbenchAdapter> {
  const preview = jest.fn<
    ReturnType<TranslationWorkbenchAdapter['preview']>,
    Parameters<TranslationWorkbenchAdapter['preview']>
  >();
  const suggest = jest.fn<
    ReturnType<TranslationWorkbenchAdapter['suggest']>,
    Parameters<TranslationWorkbenchAdapter['suggest']>
  >();
  const review = jest.fn<
    ReturnType<TranslationWorkbenchAdapter['review']>,
    Parameters<TranslationWorkbenchAdapter['review']>
  >();
  preview.mockResolvedValue({ rows });
  suggest.mockResolvedValue({ providerStatus: 'ready', suggestions: [], skipped: [] });
  review.mockResolvedValue({ decisions: [] });
  return { preview, suggest, review };
}

describe('loadTranslationSuggestionBatch', () => {
  it('does not call suggestions for an unchanged complete template', async () => {
    const client = adapter([status(field)]);
    const completeFields = [
      field,
      { ...field, fieldRef: { ...field.fieldRef, fieldKey: 'description' as const }, sourceText: 'Slow cooked' },
    ];
    client.preview.mockResolvedValue({ rows: completeFields.map((input) => status(input)) });

    const result = await loadTranslationSuggestionBatch(completeFields, client);

    expect(client.preview).toHaveBeenCalledTimes(1);
    expect(client.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        generationIntent: 'saveReview',
        targetLocales: expect.arrayContaining(['ar', 'de', 'en', 'es', 'fr', 'it', 'nl', 'ru', 'tr', 'zh']),
        fields: completeFields,
      }),
    );
    expect(client.suggest).not.toHaveBeenCalled();
    expect(result.suggestions).toBeNull();
  });

  it('sends one deduplicated batch for a new field with a missing guest locale', async () => {
    const newField: TranslationFieldInput = {
      fieldRef: { entityType: 'product', clientKey: 'product:draft', fieldKey: 'name' }, // pragma: allowlist secret -- fake unsaved-row identity
      sourceLocale: 'tr',
      sourceText: 'Izgara köfte',
    };
    const client = adapter([status(newField, 'missing')]);

    await loadTranslationSuggestionBatch([newField, newField], client);

    expect(client.preview).toHaveBeenCalledTimes(1);
    expect(client.suggest).toHaveBeenCalledTimes(1);
    expect(client.suggest).toHaveBeenCalledWith(
      expect.objectContaining({
        generationIntent: 'saveReview',
        fields: [newField],
      }),
    );
  });

  it('offers explicit fill for unchanged existing fields with gaps', async () => {
    const client = adapter([status(field, 'missing')]);

    await loadTranslationSuggestionBatch([field], client, 'explicitFill');

    expect(client.suggest).toHaveBeenCalledWith(
      expect.objectContaining({
        generationIntent: 'explicitFill',
        fields: [field],
      }),
    );
  });

  it('does not call either endpoint when there are no visible source fields', async () => {
    const client = adapter();

    await loadTranslationSuggestionBatch([], client);

    expect(client.preview).not.toHaveBeenCalled();
    expect(client.suggest).not.toHaveBeenCalled();
  });
});
