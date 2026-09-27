import { renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import type { TranslationReviewField } from '@/components/admin/product-editor/translations/translationReviewFields';
import type { TranslationWorkbenchAdapter } from '@/services/translationWorkbenchService';
import { useTranslationSuggestionBatch } from './useTranslationSuggestionBatch';

describe('useTranslationSuggestionBatch request failures', () => {
  it('retains a server-authored failure message for the review alert', async () => {
    const field = {
      input: {
        fieldRef: { entityType: 'product', entityId: 'product-1', fieldKey: 'name' },
        sourceLocale: 'en',
        sourceText: 'Soup',
      },
      sourceLocaleKnown: true,
    } as TranslationReviewField;
    const adapter: TranslationWorkbenchAdapter = {
      preview: jest.fn().mockRejectedValue(new ApiError(503, '', ['Translation provider unavailable'])),
      suggest: jest.fn(),
      review: jest.fn(),
    };
    const readFields = jest.fn(() => [field]);

    const { result } = renderHook(() => useTranslationSuggestionBatch({ isOpen: true, readFields, adapter }));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.errorMessage).toBe('Translation provider unavailable');
    expect(result.current.phase).toBe('error');
  });
});
