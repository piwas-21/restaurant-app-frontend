import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DeliveryChannelPreview } from '@/types/deliveryChannelCatalogue';
import DeliveryChannelPublishConfirmationModal from './DeliveryChannelPublishConfirmationModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { store?: string; count?: number }) =>
      key === 'deliveryChannels.publication.confirmSummary'
        ? `Replace Uber menu at ${options?.store} with ${options?.count} reviewed items`
        : key,
  }),
}));

const preview: DeliveryChannelPreview = {
  draftRevision: 'draft-revision',
  mappingRevision: 'mapping-revision',
  sourceRevision: 'source-revision',
  publicationRevision: 'publication-revision',
  currency: 'EUR',
  canPublish: true,
  items: [],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'currentReadback',
  blockingCodes: [],
  warningCodes: [],
};

it('shows a human replacement summary and keeps technical IDs collapsed until confirmed', async () => {
  const onPublish = jest.fn().mockResolvedValue(null);
  const onClose = jest.fn();
  render(
    <DeliveryChannelPublishConfirmationModal
      isOpen
      canPublish
      busy={null}
      preview={{
        ...preview,
        items: [
          {
            providerItemId: 'uber-item',
            providerItemName: 'Falafel',
            productId: 'product-1',
            variationId: null,
            productName: 'Falafel',
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
      }}
      storeName="Sofra Genève"
      storeId="uber-store-42"
      onClose={onClose}
      onPublish={onPublish}
    />,
  );

  expect(screen.getByText('Replace Uber menu at Sofra Genève with 1 reviewed items')).toBeInTheDocument();
  expect(screen.getByText('uber-store-42')).not.toBeVisible();
  expect(screen.getByRole('button', { name: 'deliveryChannels.publication.confirmPublish' })).toBeDisabled();
  expect(onPublish).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText('deliveryChannels.publication.technicalDetails'));
  expect(screen.getByText('uber-store-42')).toBeVisible();
  expect(screen.getByText('publication-revision')).toBeVisible();

  fireEvent.click(screen.getByRole('checkbox', { name: 'deliveryChannels.publication.confirmFullReplacement' }));
  fireEvent.click(screen.getByRole('button', { name: 'deliveryChannels.publication.confirmPublish' }));
  await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does not allow the confirmation action while publishing is in flight', () => {
  const onPublish = jest.fn();
  render(
    <DeliveryChannelPublishConfirmationModal
      isOpen
      canPublish
      busy="publish"
      preview={preview}
      storeName="Sofra Genève"
      storeId="uber-store-42"
      onClose={jest.fn()}
      onPublish={onPublish}
    />,
  );

  expect(screen.getByRole('button', { name: 'deliveryChannels.loading' })).toBeDisabled();
  expect(onPublish).not.toHaveBeenCalled();
});
