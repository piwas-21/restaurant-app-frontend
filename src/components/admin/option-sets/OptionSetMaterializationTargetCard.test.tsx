import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OptionSetEntry } from '@/types/optionSet';
import type { OptionSetMaterializationTarget } from '@/utils/optionSetMaterialization';
import OptionSetMaterializationTargetCard from './OptionSetMaterializationTargetCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'option_set_setting_diff'
        ? `${values?.setting}: ${values?.current} → ${values?.proposed}`
        : key === 'option_set_preserved_fields'
          ? `Preserved local fields: ${values?.fields}`
          : key,
  }),
}));

const target: OptionSetMaterializationTarget = {
  targetKey: 'ingredient:product-1:root',
  targetProductId: 'product-1',
  targetProductName: 'Kebab plate',
  role: 'ingredient',
  expectedAttachmentVersion: null,
  selected: true,
  conflictPolicy: 'useOverrides',
  settings: {},
  overrides: {},
  intentionalDifferenceReason: '',
};

const entries: OptionSetEntry[] = [
  {
    id: 'entry-1',
    name: 'Onion',
    displayOrder: 0,
    isOptional: true,
    maxQuantity: 1,
    price: 0,
    isIncludedInBasePrice: true,
    isRequired: false,
    additionalPrice: 0,
    isDefault: false,
  },
];

describe('OptionSetMaterializationTargetCard', () => {
  it('keeps explicit false and zero local overrides in the preview request state', () => {
    const onUpdate = jest.fn();
    render(
      <OptionSetMaterializationTargetCard
        target={target}
        kind="ingredient"
        entries={entries}
        preview={null}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText('editor_section_advanced'));
    fireEvent.change(screen.getByLabelText('ingredient_is_optional'), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText('option_set_entry_price'), { target: { value: '0' } });

    expect(onUpdate).toHaveBeenNthCalledWith(1, { overrides: { 'entry-1': { isOptional: false } } });
    expect(onUpdate).toHaveBeenNthCalledWith(2, { overrides: { 'entry-1': { price: 0 } } });
  });

  it('sends explicit clearMaxSelection intent when a sauce cap is cleared', () => {
    const onUpdate = jest.fn();
    render(
      <OptionSetMaterializationTargetCard
        target={{
          ...target,
          targetKey: 'sauce:product-1:root',
          role: 'sauce',
          settings: { maxSelection: 3 },
        }}
        kind="sauce"
        entries={entries}
        preview={null}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText('editor_section_advanced'));
    fireEvent.change(screen.getByLabelText('maximum_selection'), { target: { value: '' } });

    expect(onUpdate).toHaveBeenCalledWith({ settings: { clearMaxSelection: true } });
  });

  it('removes the clear intent when a numeric sauce cap is entered', () => {
    const onUpdate = jest.fn();
    render(
      <OptionSetMaterializationTargetCard
        target={{ ...target, role: 'sauce', settings: { clearMaxSelection: true } }}
        kind="sauce"
        entries={entries}
        preview={null}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByText('editor_section_advanced'));
    fireEvent.change(screen.getByLabelText('maximum_selection'), { target: { value: '2' } });

    expect(onUpdate).toHaveBeenCalledWith({ settings: { maxSelection: 2 } });
  });

  it('shows attachment setting changes even when no entry rows changed', () => {
    render(
      <OptionSetMaterializationTargetCard
        target={{ ...target, conflictPolicy: 'preserveLocal' }}
        kind="ingredient"
        entries={entries}
        preview={{
          optionSetId: 'set-1',
          setVersion: 2,
          relatedOfferWarnings: [],
          targets: [
            {
              targetKey: target.targetKey,
              targetProductId: target.targetProductId,
              status: 'ready',
              conflicts: [],
              changes: [],
              currentSettings: { minSelection: 0, maxSelection: 1, includedFree: 0 },
              proposedSettings: { minSelection: 1, maxSelection: 2, includedFree: 0 },
              changedSettings: ['minSelection', 'maxSelection'],
            },
          ],
        }}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText('minimum_selection: 0 → 1')).toBeInTheDocument();
    expect(screen.getByText('maximum_selection: 1 → 2')).toBeInTheDocument();
    expect(screen.getByText('editor_section_advanced').closest('details')).not.toHaveAttribute('open');
  });

  it('names affected options and translates changed and retained fields in the linked update preview', () => {
    render(
      <OptionSetMaterializationTargetCard
        target={target}
        kind="ingredient"
        entries={[...entries, { ...entries[0], id: 'entry-2', name: 'Potato' }]}
        preview={{
          optionSetId: 'set-1',
          setVersion: 2,
          relatedOfferWarnings: [],
          targets: [
            {
              targetKey: target.targetKey,
              targetProductId: target.targetProductId,
              status: 'ready',
              conflicts: [],
              changes: [
                {
                  entryId: 'entry-1',
                  rowType: 'ProductIngredient',
                  action: 'update',
                  changedFields: ['Price', 'DisplayOrder'],
                  preservedFields: ['MaxQuantity'],
                },
                {
                  entryId: 'entry-2',
                  rowType: 'ProductIngredient',
                  action: 'add',
                  changedFields: [],
                  preservedFields: [],
                },
              ],
              currentSettings: {},
              proposedSettings: {},
              changedSettings: [],
            },
          ],
        }}
        onUpdate={jest.fn()}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('option_set_change_update · Onion');
    expect(rows[0]).toHaveTextContent('option_set_entry_price · display_order');
    expect(rows[0]).toHaveTextContent('Preserved local fields: option_set_entry_max_quantity');
    expect(rows[0]).not.toHaveTextContent('DisplayOrder');
    expect(rows[1]).toHaveTextContent('option_set_change_add · Potato');
    expect(rows[1]).not.toHaveTextContent('option_set_no_field_changes');
  });
});
