import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('records blank item ingredient and allergen reviews as explicit empty lists', () => {
    const onDecisionChange = jest.fn();
    render(
      <CatalogueImportOperationalReview
        itemType="item"
        decision={baseDecision}
        disabled={false}
        onDecisionChange={onDecisionChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_ingredients' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_allergens' }));

    expect(onDecisionChange).toHaveBeenNthCalledWith(1, { ingredientsReviewed: true, ingredients: [] });
    expect(onDecisionChange).toHaveBeenNthCalledWith(2, { allergensReviewed: true, allergens: [] });
  });

  it('records a blank bundle allergen review without requiring an ingredient list', () => {
    const onDecisionChange = jest.fn();
    render(
      <CatalogueImportOperationalReview
        itemType="bundle"
        decision={baseDecision}
        disabled={false}
        onDecisionChange={onDecisionChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_allergens' }));

    expect(onDecisionChange).toHaveBeenCalledWith({ allergensReviewed: true, allergens: [] });
    expect(screen.queryByRole('textbox', { name: 'catalogue_import_local_ingredients' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'catalogue_import_kitchen_type' })).not.toBeInTheDocument();
  });

  it('asks for bundle component review without inventing bundle ingredient or kitchen fields', () => {
    const onDecisionChange = jest.fn();
    render(
      <CatalogueImportOperationalReview
        itemType="bundle"
        decision={baseDecision}
        disabled={false}
        onDecisionChange={onDecisionChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_bundle_ingredients' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_bundle_kitchen' }));

    expect(onDecisionChange).toHaveBeenNthCalledWith(1, { ingredientsReviewed: true });
    expect(onDecisionChange).toHaveBeenNthCalledWith(2, { kitchenRoutingReviewed: true });
  });

  it('preserves existing ingredient and allergen lists when marking them reviewed', () => {
    const onDecisionChange = jest.fn();
    render(
      <CatalogueImportOperationalReview
        itemType="item"
        decision={{ ...baseDecision, ingredients: ['Tomato'], allergens: ['Milk'] }}
        disabled={false}
        onDecisionChange={onDecisionChange}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_ingredients' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'catalogue_import_review_allergens' }));

    expect(onDecisionChange).toHaveBeenNthCalledWith(1, {
      ingredientsReviewed: true,
      ingredients: ['Tomato'],
    });
    expect(onDecisionChange).toHaveBeenNthCalledWith(2, {
      allergensReviewed: true,
      allergens: ['Milk'],
    });
  });
});
