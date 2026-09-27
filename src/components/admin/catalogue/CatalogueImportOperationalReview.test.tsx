import React from 'react';
import { render, screen } from '@testing-library/react';
import { OrderType } from '@/types/order';
import CatalogueImportOperationalReview from './CatalogueImportOperationalReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const baseDecision = { templateId: 'item-1', revision: 1, resolution: 'Create' as const };

describe('CatalogueImportOperationalReview order channels', () => {
  it('shows the validation error for an empty custom selection', () => {
    render(
      <CatalogueImportOperationalReview
        itemType="item"
        decision={{ ...baseDecision, availableOrderTypes: [] }}
        disabled={false}
        onDecisionChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('catalogue_import_order_type_required');
  });

  it('does not let the last selected channel be removed', () => {
    render(
      <CatalogueImportOperationalReview
        itemType="item"
        decision={{ ...baseDecision, availableOrderTypes: [OrderType.DineIn] }}
        disabled={false}
        onDecisionChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'order_type_dine_in' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'order_type_takeaway' })).toBeEnabled();
  });
});
