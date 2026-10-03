import { render, screen } from '@testing-library/react';
import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import type { DeliveryChannelCategoryInventory } from '@/types/deliveryChannelMenuSelection';
import DeliveryChannelCategorySelectionPanel from './DeliveryChannelCategorySelectionPanel';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('explains that category selection follows the primary category and items stay individually selectable', () => {
  const inventory: DeliveryChannelCategoryInventory = {
    selectionMode: 'categoryItemsV1',
    categoryBasis: 'primaryCategory',
    maximumSelectedItemCount: 200,
    maximumCategoryCount: 1000,
    maximumItemOverrideCount: 2000,
    sourceRevision: 'source-1',
    language: 'en',
    categories: [],
    sourceChanged: false,
    draft: null,
  };
  const catalogue: DeliveryChannelCatalogue = {
    selectionMode: 'categoryItemsV1',
    draft: null,
    selectedItems: [],
    taxProfile: null,
    taxProfileRevision: null,
    storeId: 'store-1',
    currency: 'EUR',
    mappingRevision: 'mapping-1',
    draftRevision: 'draft-1',
    sourceRevision: 'source-1',
    canPublish: false,
    items: [],
    serviceAvailability: [],
    serviceHoursEditable: false,
    serviceHoursStatus: 'reviewedTemplate',
    currentServiceAvailability: [],
    currentServiceHoursStatus: 'unknown',
    blockingCodes: [],
    warningCodes: [],
    latestPublication: null,
  };

  render(
    <DeliveryChannelCategorySelectionPanel
      inventory={inventory}
      catalogue={catalogue}
      categoryIds={new Set()}
      overrides={{}}
      candidates={[]}
      cursor={null}
      selectedCount={0}
      unsupportedCount={0}
      busy={null}
      candidateBusy={false}
      candidateError={false}
      error="load"
      loadErrorMessage="The current menu snapshot could not be loaded."
      removedSelectionNotice={false}
      needsSave={true}
      stale={true}
      writeUncertain={false}
      locale="en"
      onSearch={jest.fn()}
      onLoadMore={jest.fn()}
      onToggleCategory={jest.fn()}
      onToggleItem={jest.fn()}
      onSave={jest.fn()}
      onRefresh={jest.fn()}
      onPreview={jest.fn()}
    />,
  );

  expect(screen.getByText('deliveryChannels.menuSelection.categoryBasisNotice')).toBeInTheDocument();
  expect(screen.getByText('The current menu snapshot could not be loaded.')).toHaveAttribute('role', 'alert');
  expect(screen.getByRole('button', { name: 'deliveryChannels.menuSelection.save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menu.preparePreview' })).toBeDisabled();
});
