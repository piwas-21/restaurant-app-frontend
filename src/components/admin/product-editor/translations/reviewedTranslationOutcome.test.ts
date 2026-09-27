import { buildReviewedTranslationOutcome } from './reviewedTranslationOutcome';
import type { TranslationReviewField } from './translationReviewFields';
import type { TranslationFieldStatus } from '@/services/translationWorkbenchService';
import type { TranslationSuggestionEntry } from '@/hooks/admin/useTranslationSuggestionBatch';

const ref = { entityType: 'product' as const, entityId: 'product-1', fieldKey: 'name' as const };
const field: TranslationReviewField = {
  sourceLocaleKnown: true,
  input: { fieldRef: ref, sourceLocale: 'tr', sourceText: 'Izgara köfte' },
  slot: {
    key: 'product:name',
    group: 'item',
    ref: { target: 'item', field: 'name' },
    fieldLabel: 'item_name',
    multiline: false,
    source: 'Izgara köfte',
    translations: {},
  },
};
const previewRow: TranslationFieldStatus = {
  fieldRef: ref,
  sourceLocale: 'tr',
  sourceText: 'Izgara köfte',
  sourceHash: 'hash-1',
  targets: [{ locale: 'fr', status: 'missing', text: null }],
};
const suggestion: TranslationSuggestionEntry = {
  suggestion: {
    suggestionId: 'suggestion-1',
    fieldRef: ref,
    locale: 'fr',
    sourceHash: 'hash-1',
    text: 'Köfte grillée',
    provider: 'provider',
    model: 'model',
    status: 'suggested',
  },
  sourceText: 'Izgara köfte',
  fieldLabel: 'item_name',
  decision: 'accepted',
  text: 'Köfte grillée',
};

describe('buildReviewedTranslationOutcome', () => {
  it('stages accepted text only while the source and target preview remain unchanged', () => {
    const outcome = buildReviewedTranslationOutcome({
      decisions: [{ suggestionId: 'suggestion-1', decision: 'accept', status: 'accepted', text: 'Köfte grillée' }],
      selected: [suggestion],
      requestedFields: [field],
      currentFields: [field],
      previewRows: [previewRow],
      acceptedIds: {},
    });

    expect(outcome.changes).toEqual([{ fieldRef: ref, locale: 'fr', text: 'Köfte grillée' }]);
    expect(outcome.acceptedIds).toEqual({ 'product|product-1||name|fr': 'suggestion-1' });
    expect(outcome.staleCount).toBe(0);
  });

  it('does not apply a reviewed suggestion after the source text changes', () => {
    const changedField: TranslationReviewField = {
      ...field,
      input: { ...field.input, sourceText: 'Izgara köfte special' },
    };
    const outcome = buildReviewedTranslationOutcome({
      decisions: [{ suggestionId: 'suggestion-1', decision: 'accept', status: 'accepted' }],
      selected: [suggestion],
      requestedFields: [field],
      currentFields: [changedField],
      previewRows: [previewRow],
      acceptedIds: {},
    });

    expect(outcome.changes).toEqual([]);
    expect(outcome.acceptedIds).toEqual({});
    expect(outcome.staleCount).toBe(1);
  });
});
