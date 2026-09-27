import React from 'react';
import { render, screen } from '@testing-library/react';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import TranslationSuggestionsReview from './TranslationSuggestionsReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

type Review = ReturnType<typeof useEditorTranslationReview>;

function review(overrides: Partial<Review>): Review {
  return {
    phase: 'error',
    entries: [],
    providerStatus: null,
    pendingLocales: 0,
    manualReviewCount: 0,
    error: true,
    errorMessage: null,
    reviewWriteError: false,
    reviewWriteErrorMessage: null,
    staleCount: 0,
    unknownSourceLocaleFields: [],
    acceptAll: jest.fn(),
    setSourceLocaleFor: jest.fn(),
    ...overrides,
  } as unknown as Review;
}

describe('TranslationSuggestionsReview errors', () => {
  it('shows the server-authored request failure instead of the generic alert', () => {
    render(<TranslationSuggestionsReview review={review({ errorMessage: 'Translation provider unavailable' })} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Translation provider unavailable');
  });

  it('shows a server-authored save failure when suggestion loading had no error detail', () => {
    render(
      <TranslationSuggestionsReview
        review={review({ reviewWriteError: true, reviewWriteErrorMessage: 'Review version is stale' })}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Review version is stale');
  });
});
