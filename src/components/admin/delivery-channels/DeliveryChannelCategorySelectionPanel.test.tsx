import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import type {
  DeliveryChannelCategoryCandidate,
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
    selectionLocked: true,
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

it('allows removing an explicitly selected empty category while keeping save and preview locked', () => {
  const props = panelProps({
    inventory: {
      ...inventory,
      categories: [
        {
          categoryId: 'mains',
          name: 'Mains',
          displayOrder: 1,
          totalItemCount: 0,
          supportedItemCount: 0,
          unsupportedItemCount: 0,
        },
      ],
      draft: savedDraft,
    },
    categoryIds: new Set(['mains']),
    selectionLocked: false,
    stale: true,
    needsSave: true,
    error: 'overrideLimit',
    loadErrorMessage: null,
  });
  const view = render(panel(props));

  expect(screen.getByText('deliveryChannels.menuSelection.overrideLimit')).toBeInTheDocument();
  expect(screen.queryByText('deliveryChannels.menuSelection.sourceChanged')).not.toBeInTheDocument();
  const checkbox = screen.getByTestId('delivery-channel-category-mains');
  expect(checkbox).toBeChecked();
  expect(checkbox).toBeEnabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menuSelection.save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menu.preparePreview' })).toBeDisabled();

  fireEvent.click(checkbox);
  expect(props.onToggleCategory).toHaveBeenCalledWith('mains', false);

  view.rerender(
    panel({
      ...props,
      inventory: { ...props.inventory, sourceChanged: true },
    }),
  );
  expect(screen.getByText('deliveryChannels.menuSelection.sourceChanged')).toHaveAttribute('role', 'alert');
});

it('limits override recovery to removing existing item exceptions', () => {
  const item: DeliveryChannelCategoryCandidate = {
    selectionKey: 'mains-item::',
    productId: 'mains-item',
    variationId: null,
    categoryId: 'mains',
    categoryName: 'Mains',
    categoryDisplayOrder: 1,
    itemDisplayOrder: 1,
    name: 'Mains item',
    variationName: null,
    priceMinor: 500,
    available: true,
    supported: true,
    blockReason: null,
  };
  const props = panelProps({
    inventory: {
      ...inventory,
      categories: [
        {
          categoryId: 'mains',
          name: 'Mains',
          displayOrder: 1,
          totalItemCount: 1,
          supportedItemCount: 1,
          unsupportedItemCount: 0,
        },
      ],
    },
    candidates: [item],
    stale: true,
    selectionLocked: false,
    error: 'overrideLimit',
    loadErrorMessage: null,
  });
  const view = render(panel(props));
  const checkbox = screen.getByTestId(`delivery-channel-menu-item-${item.selectionKey}`);
  expect(checkbox).toBeDisabled();

  view.rerender(
    panel({
      ...props,
      overrides: {
        [item.selectionKey]: {
          selectionKey: item.selectionKey,
          productId: item.productId,
          variationId: item.variationId,
          categoryId: 'mains',
          selected: true,
          supported: true,
        },
      },
    }),
  );
  expect(checkbox).toBeEnabled();
  fireEvent.click(checkbox);
  expect(props.onToggleItem).toHaveBeenCalledWith(item, false);
  expect(screen.getByRole('button', { name: 'deliveryChannels.menuSelection.save' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'deliveryChannels.menu.preparePreview' })).toBeDisabled();
});
