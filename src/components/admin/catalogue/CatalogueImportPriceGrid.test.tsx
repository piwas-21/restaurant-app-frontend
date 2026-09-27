import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CatalogueImportPriceGrid, { type CatalogueImportPriceRow } from './CatalogueImportPriceGrid';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const offer: CatalogueImportPriceRow = {
  item: {
    templateId: 'meal',
    revision: 2,
    type: 'bundle',
    displayName: 'Meal',
    description: null,
    contentHash: 'hash',
    isRoot: true,
    isSelectable: false,
    isSelected: true,
    selectionRole: 'root',
    status: 'Pending',
    localEntityType: null,
    localEntityId: null,
    failureCode: null,
    decision: null,
  },
  decision: {
    templateId: 'meal',
    revision: 2,
    resolution: 'Create',
    localPrice: 0,
    localOptionPrices: { 'sauce@3': 0 },
  },
  priceRefs: [
    { key: 'sauce@3', name: 'Sauce' },
    { key: 'side@1', name: 'Side' },
  ],
};

describe('CatalogueImportPriceGrid', () => {
  it('shows base and choice prices together and preserves explicit zero values', () => {
    const onChange = jest.fn();
    render(<CatalogueImportPriceGrid rows={[offer]} canEditDecision={() => true} onDecisionChange={onChange} />);

    const priceFields = screen.getAllByRole('spinbutton');
    expect(priceFields).toHaveLength(3);
    expect(priceFields[0]).toHaveValue(0);
    expect(priceFields[1]).toHaveValue(0);
    expect(priceFields[2]).toHaveValue(null);

    fireEvent.change(priceFields[2], { target: { value: '2.5' } });
    expect(onChange).toHaveBeenCalledWith(offer.item, { localOptionPrices: { 'sauce@3': 0, 'side@1': 2.5 } });
  });

  it('requires choice-rule review for a reused set without repricing its local entries', () => {
    const reused = {
      ...offer,
      item: { ...offer.item, templateId: 'set', type: 'option-set' as const },
      decision: { ...offer.decision, templateId: 'set', resolution: 'Reuse' as const, localEntityId: 'local-set' },
    };
    const onChange = jest.fn();
    render(<CatalogueImportPriceGrid rows={[reused]} canEditDecision={() => true} onDecisionChange={onChange} />);

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_choice_rules' }));
    expect(onChange).toHaveBeenCalledWith(reused.item, { choiceRulesReviewed: true });
  });
});
