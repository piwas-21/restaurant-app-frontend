import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeliveryChannelManagement from './DeliveryChannelManagement';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItem,
} from '@/types/deliveryChannelMenuSelection';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }),
}));

const storeSummary: DeliveryChannelManagementSummary = {
  provider: 'uber-eats',
  enabled: true,
  sandboxOnly: true,
  connectionStatus: 'connected',
  healthStatus: 'healthy',
  storeId: 'store-1',
  currency: 'EUR',
  storeConfirmed: true,
  storeDisplayName: 'Sofra Sandbox',
  integrationEnabled: true,
  isOrderManager: true,
  pendingMerchantActivation: false,
  requireManualAcceptance: true,
  paused: false,
  checkedAt: '2026-10-03T10:00:00Z',
  degradedReason: null,
  latestPublication: null,
  capabilities: {
    supportsSimpleItems: true,
    supportsVariations: true,
    supportsModifiers: false,
    supportsBundles: false,
    supportsItemAvailability: true,
    supportsStoreHoursEditing: false,
    supportsAutomaticAcceptance: true,
  },
};

const frozenItem: DeliveryChannelCategoryItem = {
  selectionKey: 'product-1:null',
  providerItemId: 'uber-item-1',
  productId: 'product-1',
  variationId: null,
  categoryId: 'category-1',
  categoryName: 'Drinks',
  categoryDisplayOrder: 0,
  itemDisplayOrder: 0,
  name: 'Tea',
  variationName: null,
  priceMinor: 300,
  available: true,
  supported: true,
  blockReason: null,
};

const frozenDraft: DeliveryChannelCategoryDraft = {
  draftRevision: 'draft-1',
  sourceRevision: 'source-1',
  language: 'en',
  selectedCategoryIds: ['category-1'],
  itemOverrides: [],
  categories: [
    {
      categoryId: 'category-1',
      name: 'Drinks',
      displayOrder: 0,
      totalItemCount: 1,
      supportedItemCount: 1,
      unsupportedItemCount: 0,
      selectedItemCount: 1,
      selectedUnsupportedItemCount: 0,
      selectionState: 'all',
    },
  ],
  items: [frozenItem],
};

const staleCatalogue: DeliveryChannelCatalogue = {
  selectionMode: 'categoryItemsV1',
  sourceChanged: true,
  draftSourceRevision: 'source-1',
  draftRevision: 'draft-1',
  mappingRevision: 'mapping-1',
  sourceRevision: 'source-2',
  canPublish: false,
  storeId: 'store-1',
  currency: 'EUR',
  items: [],
  selectedItems: [frozenItem],
  serviceAvailability: [],
  serviceHoursEditable: false,
  serviceHoursStatus: 'reviewedTemplate',
  currentServiceAvailability: [],
  currentServiceHoursStatus: 'unknown',
  blockingCodes: ['source_changed'],
  warningCodes: [],
  latestPublication: null,
};

const staleInventory: DeliveryChannelCategoryInventory = {
  selectionMode: 'categoryItemsV1',
  categoryBasis: 'primaryCategory',
  maximumSelectedItemCount: 200,
  maximumCategoryCount: 1000,
  maximumItemOverrideCount: 2000,
  draftRevision: 'draft-1',
  sourceRevision: 'source-2',
  language: 'en',
  categories: [
    {
      categoryId: 'category-1',
      name: 'Drinks',
      displayOrder: 0,
      totalItemCount: 2,
      supportedItemCount: 2,
      unsupportedItemCount: 0,
    },
  ],
  sourceChanged: true,
  draft: frozenDraft,
};

afterEach(() => jest.restoreAllMocks());

it('keeps the category workflow reachable from a stale successful catalogue read and blocks save and preview', async () => {
  jest.spyOn(deliveryChannelManagementService, 'getSummary').mockResolvedValue(storeSummary);
  jest.spyOn(deliveryChannelManagementService, 'getAvailability').mockResolvedValue({
    enabled: true,
    paused: false,
    pausedUntil: null,
    checkedAt: '2026-10-03T10:00:00Z',
    storeStatus: 'available',
    items: [],
  });
  jest.spyOn(deliveryChannelManagementService, 'getExceptions').mockResolvedValue({
    items: [],
    nextCursor: null,
    checkedAt: '2026-10-03T10:00:00Z',
  });
  const getCatalogue = jest.spyOn(deliveryChannelManagementService, 'getCatalogue').mockResolvedValue(staleCatalogue);
  jest.spyOn(deliveryChannelManagementService, 'getCandidates').mockResolvedValue({
    currency: 'EUR',
    language: 'en',
    nextCursor: null,
    items: [],
  });
  const getCategoryInventory = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryInventory')
    .mockResolvedValue(staleInventory);
  const getCategoryCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValue({
      sourceRevision: 'source-2',
      language: 'en',
      nextCursor: null,
      items: [],
    });

  render(<DeliveryChannelManagement />);
  fireEvent.click(await screen.findByRole('tab', { name: 'deliveryChannels.workspace.menu' }));

  expect(await screen.findByRole('heading', { name: 'deliveryChannels.menuSelection.title' })).toBeInTheDocument();
  expect(getCatalogue).toHaveBeenCalled();
  await waitFor(() => expect(getCategoryInventory).toHaveBeenCalled());
  await waitFor(() => expect(getCategoryCandidates).toHaveBeenCalledWith('', null, null, 'source-2'));
  expect(screen.getByText('deliveryChannels.menuSelection.sourceChanged')).toHaveAttribute('role', 'alert');
  expect(screen.getByRole('button', { name: 'deliveryChannels.menuSelection.refresh' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menuSelection.save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menu.preparePreview' })).toBeDisabled();
});
