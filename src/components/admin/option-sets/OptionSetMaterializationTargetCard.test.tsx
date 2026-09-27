import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OptionSetEntry } from '@/types/optionSet';
import type { OptionSetMaterializationTarget } from '@/utils/optionSetMaterialization';
import OptionSetMaterializationTargetCard from './OptionSetMaterializationTargetCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

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

    fireEvent.change(screen.getByLabelText('maximum_selection'), { target: { value: '2' } });

    expect(onUpdate).toHaveBeenCalledWith({ settings: { maxSelection: 2 } });
  });
});
