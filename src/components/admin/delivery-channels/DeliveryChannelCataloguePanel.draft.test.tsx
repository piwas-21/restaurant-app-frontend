import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { DeliveryChannelCatalogue, DeliveryChannelCatalogueCandidate } from '@/types/deliveryChannelCatalogue';
import DeliveryChannelCataloguePanel from './DeliveryChannelCataloguePanel';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const fresh: DeliveryChannelCatalogueCandidate = {
  productId: 'fresh',
  variationId: null,
  name: 'Fresh meal',
  variationName: null,
  priceMinor: 750,
  available: true,
  supported: true,
  blockReason: '',
};
const catalogue: DeliveryChannelCatalogue = {
  storeId: 'store-1',
  currency: 'EUR',
  mappingRevision: 'mapping-1',
  draftRevision: 'draft-1',
  sourceRevision: 'source-1',
  canPublish: false,
  items: [
    {
      providerItemId: 'provider-1',
      providerItemName: 'Uber meal',
      productId: 'saved',
      variationId: null,
      productName: 'Saved meal',
      variationName: null,
      tenantPriceMinor: 500,
      providerPriceMinor: 500,
      providerPriceStatus: 'currentReadback',
      currency: 'EUR',
      available: true,
      mappingStatus: 'mapped',
      blockReason: null,
    },
  ],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: [],
  warningCodes: [],
  latestPublication: null,
};
function Harness({ candidates }: { readonly candidates: readonly DeliveryChannelCatalogueCandidate[] }) {
  const [selected, setSelected] = useState({ 'provider-1': 'saved::' });
  return (
    <DeliveryChannelCataloguePanel
      catalogue={catalogue}
      candidates={candidates}
      knownCandidates={[fresh]}
      selected={selected}
      candidateCursor={null}
      busy={null}
      error={null}
      stale={false}
      dirty
      duplicateSelection={false}
      writeUncertain={false}
      locale="en"
      onChoose={(id, value) => setSelected((previous) => ({ ...previous, [id]: value }))}
      onSearch={jest.fn()}
      onSave={jest.fn()}
      onPreview={jest.fn()}
    />
  );
}

it('shows the unsaved selection price and name after a candidate search and filters the actual draft', () => {
  const { rerender } = render(<Harness candidates={[fresh]} />);
  fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mapToTenantItem'), {
    target: { value: 'fresh::' },
  });
  rerender(<Harness candidates={[]} />);
  expect(screen.getByRole('option', { name: 'Fresh meal' })).toBeInTheDocument();
  const row = screen.getByText('Uber meal').closest('li');
  if (!row) throw new Error('Expected the selected provider row');
  expect(within(row).getByText('deliveryChannels.menu.tenantPrice: €7.50')).toBeInTheDocument();
  expect(within(row).getByText(/deliveryChannels.menu.providerPrice: €5.00/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mappingSearchLabel'), {
    target: { value: 'Fresh meal' },
  });
  expect(screen.getByText('Uber meal')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mappingFilterLabel'), { target: { value: 'mapped' } });
  fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mapToTenantItem'), { target: { value: '' } });
  expect(screen.queryByText('Uber meal')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mappingSearchLabel'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('deliveryChannels.menu.mappingFilterLabel'), {
    target: { value: 'unmapped' },
  });
  expect(screen.getByText('Uber meal')).toBeInTheDocument();
  const unmappedRow = screen.getByText('Uber meal').closest('li');
  if (!unmappedRow) throw new Error('Expected the unmapped provider row');
  expect(within(unmappedRow).getByText('deliveryChannels.menu.mapping.unmapped')).toBeInTheDocument();
  expect(screen.queryByText('deliveryChannels.menu.tenantPrice: €7.50')).not.toBeInTheDocument();
});
