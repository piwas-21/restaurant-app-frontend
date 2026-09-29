import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CatalogueImportSession } from '@/services/catalogueImportService';
import CatalogueImportSelectionReview from './CatalogueImportSelectionReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const baseItem: CatalogueImportSession['items'][number] = {
  templateId: 'pack',
  revision: 1,
  type: 'cuisine-pack',
  displayName: 'Turkish pack',
  description: null,
  contentHash: 'pack-hash',
  isRoot: true,
  isSelectable: false,
  isSelected: true,
  selectionRole: 'root',
  status: 'Pending',
  localEntityType: null,
  localEntityId: null,
  failureCode: null,
  decision: null,
};

const session: CatalogueImportSession = {
  sessionId: 'session',
  rootTemplateId: 'pack',
  rootRevision: 1,
  locale: 'en',
  version: 1,
  status: 'Draft',
  createNewCopy: false,
  items: [
    baseItem,
    {
      ...baseItem,
      templateId: 'offer',
      type: 'item',
      displayName: 'Ayran',
      contentHash: 'offer-hash',
      isRoot: false,
      isSelectable: true,
      selectionRole: 'offer',
    },
    {
      ...baseItem,
      templateId: 'ingredient',
      type: 'ingredient',
      displayName: 'Yoghurt',
      contentHash: 'ingredient-hash',
      isRoot: false,
      selectionRole: 'dependency',
    },
  ],
};

const shared = {
  session,
  selectedIds: ['pack', 'offer', 'ingredient'],
  decisions: {
    'offer@1': { templateId: 'offer', revision: 1, resolution: 'Create' as const },
    'ingredient@1': { templateId: 'ingredient', revision: 1, resolution: 'Create' as const },
  },
  priceRefsByOwner: {},
  detailsByKey: {},
  canEditSelection: true,
  canEditDecision: () => true,
  onToggleSelection: jest.fn(),
  onDecisionChange: jest.fn(),
};

it('starts with optional offers and keeps required dependencies compact', () => {
  render(<CatalogueImportSelectionReview {...shared} mode="selection" />);
  expect(screen.getByRole('checkbox', { name: 'catalogue_import_include_offer' })).toBeInTheDocument();
  expect(screen.getByText('catalogue_import_dependencies').closest('details')).not.toHaveAttribute('open');
  expect(screen.queryByRole('textbox', { name: 'catalogue_import_local_ingredients' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'catalogue_import_price_grid_title' })).not.toBeInTheDocument();
});

it('reviews one selected item and its price at a time', () => {
  const onActiveItemChange = jest.fn();
  render(
    <CatalogueImportSelectionReview
      {...shared}
      mode="details"
      activeItemKey="offer@1"
      onActiveItemChange={onActiveItemChange}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Ayran', level: 2 })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'catalogue_import_local_ingredients' })).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yoghurt' }));
  expect(onActiveItemChange).toHaveBeenCalledWith('ingredient@1');
});
