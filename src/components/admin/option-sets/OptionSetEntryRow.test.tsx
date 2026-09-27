import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useOptionSetProductVariations } from '@/hooks/admin/useOptionSetProductVariations';
import type { OptionSetEntry } from '@/types/optionSet';
import OptionSetEntryRow from './OptionSetEntryRow';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/admin/useOptionSetProductVariations', () => ({ useOptionSetProductVariations: jest.fn() }));
jest.mock('./OptionSetReferenceSearch', () => ({ __esModule: true, default: () => null }));

const useVariationsMock = jest.mocked(useOptionSetProductVariations);

function entry(productVariationId?: string): OptionSetEntry {
  return {
    id: 'entry-1',
    name: 'Side salad',
    displayOrder: 0,
    productId: 'product-1',
    ...(productVariationId ? { productVariationId } : {}),
    isOptional: true,
    maxQuantity: 1,
    price: 0,
    isIncludedInBasePrice: false,
    isRequired: false,
    additionalPrice: 0,
    isDefault: false,
  };
}

function renderEntry(productVariationId?: string, isPersistedVariationUnchanged = false) {
  return render(
    <OptionSetEntryRow
      kind="bundleChoice"
      entry={entry(productVariationId)}
      index={0}
      entryKey="entry-1"
      selectedReferenceAvailable
      isPersistedVariationUnchanged={isPersistedVariationUnchanged}
      usedReferences={[]}
      onChange={jest.fn()}
      onReferenceSelected={jest.fn()}
      onVariationValidityChange={jest.fn()}
      onRemove={jest.fn()}
      onMove={jest.fn()}
      canMoveUp={false}
      canMoveDown={false}
    />,
  );
}

describe('OptionSetEntryRow variation lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useVariationsMock.mockReturnValue({ variations: [], isLoading: false, error: false });
  });

  it('loads product variations only when the variation select receives focus', async () => {
    renderEntry();

    expect(useVariationsMock).toHaveBeenLastCalledWith('product-1', false);
    fireEvent.focus(screen.getByLabelText('option_set_entry_variation'));

    await waitFor(() => expect(useVariationsMock).toHaveBeenLastCalledWith('product-1', true));
  });

  it('keeps an unchanged saved variation valid without fetching product details', async () => {
    const onVariationValidityChange = jest.fn();
    render(
      <OptionSetEntryRow
        kind="bundleChoice"
        entry={entry('variation-1')}
        index={0}
        entryKey="entry-1"
        selectedReferenceAvailable
        isPersistedVariationUnchanged
        usedReferences={[]}
        onChange={jest.fn()}
        onReferenceSelected={jest.fn()}
        onVariationValidityChange={onVariationValidityChange}
        onRemove={jest.fn()}
        onMove={jest.fn()}
        canMoveUp={false}
        canMoveDown={false}
      />,
    );

    await waitFor(() => expect(onVariationValidityChange).toHaveBeenCalledWith('entry-1', true));
    expect(useVariationsMock).toHaveBeenLastCalledWith('product-1', false);
    expect(screen.queryByText('option_set_variation_unavailable')).not.toBeInTheDocument();
  });
});
