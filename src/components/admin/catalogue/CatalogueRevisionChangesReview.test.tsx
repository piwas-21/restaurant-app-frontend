import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CatalogueRevisionChangesReview from './CatalogueRevisionChangesReview';
import type { CatalogueRevisionChanges } from '@/services/catalogueRevisionChangeService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const changes: CatalogueRevisionChanges = {
  sessionId: 'session-1',
  sessionVersion: 4,
  items: [
    {
      templateId: 'meal',
      adoptedRevision: 1,
      adoptedContentHash: 'old-content',
      localHash: 'local-current',
      currentRevision: 2,
      currentContentHash: 'new-content',
      withdrawn: false,
      adoptedRevisionWithdrawn: false,
      status: 'current',
      notice: 'New source values are available.',
      fieldDiffs: [
        { path: 'name', baseline: 'Old name', current: 'New name', localValue: 'Old name', localChanged: false },
        {
          path: 'description',
          baseline: 'Old description',
          current: 'New description',
          localValue: 'Tenant description',
          localChanged: true,
        },
      ],
    },
  ],
};

describe('CatalogueRevisionChangesReview', () => {
  it('shows baseline, current and local values and applies only explicitly selected untouched fields', () => {
    const onApply = jest.fn();
    render(<CatalogueRevisionChangesReview changes={changes} isWorking={false} error={null} onApply={onApply} />);

    expect(screen.getAllByText('Old name')).toHaveLength(2);
    expect(screen.getByText('New name')).toBeInTheDocument();
    expect(screen.getByText('Tenant description')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'name' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'description' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'name' }));
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_revision_apply_selected' }));
    expect(onApply).toHaveBeenCalledWith(changes.items[0], ['name']);
  });

  it('does not offer apply when the template was withdrawn', () => {
    const withdrawn = {
      ...changes,
      items: [
        { ...changes.items[0], withdrawn: true, status: 'withdrawn', currentRevision: null, currentContentHash: null },
      ],
    };
    render(<CatalogueRevisionChangesReview changes={withdrawn} isWorking={false} error={null} onApply={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'catalogue_revision_apply_selected' })).toBeDisabled();
  });

  it('warns when the adopted revision was withdrawn even if a current revision exists', () => {
    const adoptedWithdrawn = {
      ...changes,
      items: [{ ...changes.items[0], adoptedRevisionWithdrawn: true }],
    };
    render(
      <CatalogueRevisionChangesReview changes={adoptedWithdrawn} isWorking={false} error={null} onApply={jest.fn()} />,
    );

    expect(screen.getByText('catalogue_revision_adopted_withdrawn')).toBeInTheDocument();
  });
});
