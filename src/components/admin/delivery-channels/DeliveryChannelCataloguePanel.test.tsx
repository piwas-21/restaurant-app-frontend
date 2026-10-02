import { fireEvent, render, screen } from '@testing-library/react';
import type { DeliveryChannelCatalogue, DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';
import DeliveryChannelCataloguePanel from './DeliveryChannelCataloguePanel';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function mappingRow(index: number): DeliveryChannelMappingRow {
  return {
    providerItemId: `uber-item-${index}`,
    providerItemName: `Provider item ${index}`,
    productId: index === 21 ? 'product-21' : null,
    variationId: null,
    productName: index === 21 ? 'Tenant meal 21' : null,
    variationName: null,
    tenantPriceMinor: index === 21 ? 500 : null,
    providerPriceMinor: null,
    providerPriceStatus: 'unknown',
    currency: 'EUR',
    available: false,
    mappingStatus: index === 21 ? 'mapped' : 'unmapped',
    blockReason: null,
  };
}

const catalogue: DeliveryChannelCatalogue = {
  storeId: 'store-1',
  currency: 'EUR',
  mappingRevision: 'mapping-1',
  draftRevision: 'draft-1',
  sourceRevision: 'source-1',
  canPublish: false,
  items: Array.from({ length: 21 }, (_, index) => mappingRow(index + 1)),
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: [],
  warningCodes: [],
  latestPublication: null,
};

describe('DeliveryChannelCataloguePanel mapping browser', () => {
  it('paginates provider rows and resets the page when status filtering changes', () => {
    const onSearch = jest.fn().mockResolvedValue(null);
    render(
      <DeliveryChannelCataloguePanel
        catalogue={catalogue}
        candidates={[]}
        selected={Object.fromEntries(
          catalogue.items.map((item) => [item.providerItemId, item.productId ? `${item.productId}::` : '']),
        )}
        candidateCursor={null}
        busy={null}
        error={null}
        stale={false}
        dirty={false}
        duplicateSelection={false}
        writeUncertain={false}
        locale="en"
        onChoose={jest.fn()}
        onSearch={onSearch}
        onSave={jest.fn().mockResolvedValue(true)}
        onPreview={jest.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText('uber-item-1')).toBeInTheDocument();
    expect(screen.queryByText('uber-item-21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'deliveryChannels.menu.mappingNextPage' }));
    expect(screen.getByText('uber-item-21')).toBeInTheDocument();
    expect(screen.queryByText('uber-item-1')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mappingFilterLabel'), {
      target: { value: 'mapped' },
    });
    expect(screen.getByText('uber-item-21')).toBeInTheDocument();
    expect(screen.getByLabelText('deliveryChannels.menu.mappingFilterLabel')).toHaveValue('mapped');
    expect(onSearch).not.toHaveBeenCalled();
  });
});
