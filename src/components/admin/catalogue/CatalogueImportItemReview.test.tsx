import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CatalogueImportItemReview from './CatalogueImportItemReview';
import type { CatalogueImportDecision, CatalogueImportSessionItem } from '@/services/catalogueImportService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const bundle: CatalogueImportSessionItem = {
  templateId: 'bundle',
  revision: 2,
  type: 'bundle',
  displayName: 'Meal',
  description: 'Reviewed source description',
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
};
const choicePrices = [{ key: 'size@4', name: 'Large size' }];
const decision: CatalogueImportDecision = { templateId: 'bundle', revision: 2, resolution: 'Create' };

describe('CatalogueImportItemReview', () => {
  it('starts every tenant price and safety review field empty', () => {
    render(
      <CatalogueImportItemReview
        item={bundle}
        decision={decision}
        selected
        priceRefs={choicePrices}
        onSelectedChange={jest.fn()}
        onDecisionChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'catalogue_import_local_price' })).toHaveValue(null);
    expect(screen.getByRole('spinbutton', { name: 'catalogue_import_price_for' })).toHaveValue(null);
    expect(screen.getByRole('checkbox', { name: 'catalogue_import_review_ingredients' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'catalogue_import_review_allergens' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'catalogue_import_review_option_prices' })).not.toBeChecked();
    expect(screen.getByText(/Reviewed source description/)).toBeInTheDocument();
  });

  it('asks for choice-rule review when reusing an existing option set without repricing it', () => {
    const optionSet: CatalogueImportSessionItem = { ...bundle, templateId: 'set', type: 'option-set', isRoot: false };
    render(
      <CatalogueImportItemReview
        item={optionSet}
        decision={{ ...decision, templateId: 'set', resolution: 'Reuse' }}
        selected
        priceRefs={choicePrices}
        onSelectedChange={jest.fn()}
        onDecisionChange={jest.fn()}
      />,
    );

    expect(screen.queryByRole('spinbutton', { name: 'catalogue_import_price_for' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'catalogue_import_review_choice_rules' })).not.toBeChecked();
  });

  it('lets an admin explicitly use the reviewed template name', () => {
    const onChange = jest.fn();
    render(
      <CatalogueImportItemReview
        item={bundle}
        decision={decision}
        selected
        priceRefs={[]}
        onSelectedChange={jest.fn()}
        onDecisionChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_use_suggested_name' }));

    expect(onChange).toHaveBeenCalledWith({ localName: 'Meal' });
  });

  it('requires explicit local type and intended availability for a new item', () => {
    const onChange = jest.fn();
    const item: CatalogueImportSessionItem = { ...bundle, type: 'item', templateId: 'item' };
    render(
      <CatalogueImportItemReview
        item={item}
        decision={{ ...decision, templateId: 'item' }}
        selected
        priceRefs={[]}
        onSelectedChange={jest.fn()}
        onDecisionChange={onChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'product_type' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'catalogue_import_intended_availability' })).toHaveValue('');
    expect(screen.getByText('catalogue_import_import_visibility_note')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'product_type' }), { target: { value: 'MainItem' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'catalogue_import_intended_availability' }), {
      target: { value: 'false' },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, { localProductType: 'MainItem' });
    expect(onChange).toHaveBeenNthCalledWith(2, { intendedIsAvailable: false });
  });
});
