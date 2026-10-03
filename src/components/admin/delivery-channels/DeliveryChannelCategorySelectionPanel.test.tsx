import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryInventory,
} from '@/types/deliveryChannelMenuSelection';
import DeliveryChannelCategorySelectionPanel from './DeliveryChannelCategorySelectionPanel';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

type PanelProps = ComponentProps<typeof DeliveryChannelCategorySelectionPanel>;

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

const savedDraft: DeliveryChannelCategoryDraft = {
  draftRevision: 'draft-1',
  sourceRevision: 'source-1',
  language: 'en',
  selectedCategoryIds: [],
  itemOverrides: [],
  categories: [],
  items: [],
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

function panelProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    inventory,
    catalogue,
    categoryIds: new Set(),
    overrides: {},
    candidates: [],
    cursor: null,
    selectedCount: 0,
    unsupportedCount: 0,
    busy: null,
    candidateBusy: false,
    candidateError: false,
    error: 'load',
    loadErrorMessage: 'The current menu snapshot could not be loaded.',
    removedSelectionNotice: false,
    needsSave: true,
    stale: true,
    writeUncertain: false,
    locale: 'en',
    onSearch: jest.fn(),
    onLoadMore: jest.fn(),
    onToggleCategory: jest.fn(),
    onToggleItem: jest.fn(),
    onSave: jest.fn(),
    onRefresh: jest.fn(),
    onPreview: jest.fn(),
    ...overrides,
  };
}

function panel(props: PanelProps) {
  return <DeliveryChannelCategorySelectionPanel {...props} />;
}

it('keeps the source error visible and blocks save and preview while the inventory is stale', () => {
  render(panel(panelProps()));

  expect(screen.getByText('deliveryChannels.menuSelection.categoryBasisNotice')).toBeInTheDocument();
  expect(screen.getByText('The current menu snapshot could not be loaded.')).toHaveAttribute('role', 'alert');
  expect(screen.getByRole('button', { name: 'deliveryChannels.menuSelection.save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menu.preparePreview' })).toBeDisabled();
  expect(screen.queryByText('deliveryChannels.menuSelection.needsSaveNotice')).not.toBeInTheDocument();
});

it('shows the unsaved review notice after source acknowledgment and clears it after a confirmed save', () => {
  const initial = panelProps({ inventory: { ...inventory, draft: savedDraft }, stale: true });
  const view = render(panel(initial));
  expect(screen.queryByText('deliveryChannels.menuSelection.needsSaveNotice')).not.toBeInTheDocument();

  view.rerender(panel({ ...initial, stale: false }));
  expect(screen.getByText('deliveryChannels.menuSelection.needsSaveNotice').closest('output')).toBeInTheDocument();

  view.rerender(panel({ ...initial, stale: false, needsSave: false }));
  expect(screen.queryByText('deliveryChannels.menuSelection.needsSaveNotice')).not.toBeInTheDocument();
});
