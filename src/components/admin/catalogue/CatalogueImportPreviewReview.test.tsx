import React from 'react';
import { render, screen } from '@testing-library/react';
import CatalogueImportPreviewReview from './CatalogueImportPreviewReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('identifies the exact local record selected for reuse before import', () => {
  render(
    <CatalogueImportPreviewReview
      preview={{
        sessionId: 'session-1',
        version: 3,
        items: [
          {
            templateId: 'item-1',
            revision: 1,
            type: 'item',
            displayName: 'Ayran',
            isSelected: true,
            resolution: 'Reuse',
            localEntityId: 'local-ayran',
            localEntityName: 'Restaurant Ayran',
            candidates: [],
            warnings: [],
            blockingIssues: [],
          },
        ],
      }}
      canChooseCandidate={() => true}
      onChooseCandidate={jest.fn()}
    />,
  );
  expect(screen.getByText('local-ayran')).toBeInTheDocument();
  expect(screen.getByText(/Restaurant Ayran/)).toBeInTheDocument();
});
