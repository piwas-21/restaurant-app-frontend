import { fireEvent, render, screen } from '@testing-library/react';
import type {
  DeliveryChannelCatalogue,
  DeliveryChannelCatalogueCandidate,
  DeliveryChannelMappingRow,
} from '@/types/deliveryChannelCatalogue';
import DeliveryChannelMappingList from './DeliveryChannelMappingList';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const blockedRow: DeliveryChannelMappingRow = {
  providerItemId: 'uber-template-item-1',
  providerItemName: 'Soup',
  productId: null,
  variationId: null,
  productName: null,
  variationName: null,
  tenantPriceMinor: null,
  providerPriceMinor: null,
  providerPriceStatus: 'unknown',
  currency: 'EUR',
  available: false,
  mappingStatus: 'blocked',
  blockReason: 'UnsupportedProductKind',
};

const catalogue: DeliveryChannelCatalogue = {
  storeId: 'store-1',
  currency: 'EUR',
  mappingRevision: 'mapping-1',
  draftRevision: 'draft-1',
  sourceRevision: 'source-1',
  canPublish: false,
  items: [blockedRow],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: [],
  warningCodes: [],
  latestPublication: null,
};

const candidates: DeliveryChannelCatalogueCandidate[] = [
  {
    productId: 'tenant-product-1',
    variationId: null,
    name: 'Same name',
    variationName: null,
    priceMinor: 500,
    available: true,
    supported: true,
    blockReason: '',
  },
  {
    productId: 'tenant-product-2',
    variationId: null,
    name: 'Same name',
    variationName: null,
    priceMinor: 500,
    available: true,
    supported: true,
    blockReason: '',
  },
  {
    productId: 'tenant-product-blocked',
    variationId: null,
    name: 'Unsupported bundle',
    variationName: null,
    priceMinor: null,
    available: false,
    supported: false,
    blockReason: 'UnsupportedProductKind',
  },
];

describe('DeliveryChannelMappingList', () => {
  it('keeps same-name tenant identities distinct and shows blocked source reasons without making them selectable', () => {
    render(
      <DeliveryChannelMappingList
        catalogue={catalogue}
        rows={[blockedRow]}
        candidates={candidates}
        selected={{ [blockedRow.providerItemId]: '' }}
        busy={null}
        stale={false}
        writeUncertain={false}
        locale="en"
        onChoose={jest.fn()}
      />,
    );

    expect(screen.getByText('deliveryChannels.codes.UnsupportedProductKind')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /deliveryChannels.codes.UnsupportedProductKind/ })).toBeDisabled();
    const select = screen.getByRole('combobox');
    expect(select.querySelector('option[value="tenant-product-1::"]')).toHaveTextContent('Same name');
    expect(select.querySelector('option[value="tenant-product-2::"]')).toHaveTextContent('Same name');
    const details = screen.getByText('deliveryChannels.publication.technicalDetails').closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('deliveryChannels.publication.technicalDetails'));
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('uber-template-item-1')).toBeInTheDocument();
  });
});
