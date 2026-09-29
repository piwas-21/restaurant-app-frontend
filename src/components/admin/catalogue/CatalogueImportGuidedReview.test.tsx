import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { useCatalogueImportWorkspace } from '@/hooks/admin/useCatalogueImportWorkspace';
import type { useCatalogueOptionPrices } from '@/hooks/admin/useCatalogueOptionPrices';
import type { CatalogueImportSession } from '@/services/catalogueImportService';
import CatalogueImportGuidedReview from './CatalogueImportGuidedReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const item: CatalogueImportSession['items'][number] = {
  templateId: 'item',
  revision: 1,
  type: 'item',
  displayName: 'Ayran',
  description: null,
  contentHash: 'hash',
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
  rootTemplateId: 'item',
  rootRevision: 1,
  locale: 'en',
  version: 2,
  status: 'Draft',
  createNewCopy: false,
  items: [item],
};

it('moves through offer, item, and server check stages, then routes a blocker back to its item', () => {
  const checkPreview = jest.fn();
  const flow = {
    session,
    selectedIds: ['item'],
    decisions: { 'item@1': { templateId: 'item', revision: 1, resolution: 'Create' } },
    preview: {
      sessionId: 'session',
      version: 2,
      items: [
        {
          templateId: 'item',
          revision: 1,
          type: 'item',
          displayName: 'Ayran',
          isSelected: true,
          resolution: 'Create',
          localEntityId: null,
          candidates: [],
          warnings: [],
          blockingIssues: [{ code: 'price', message: 'Local price is required' }],
        },
      ],
    },
    canManage: true,
    canEditSelection: true,
    canEditDecision: () => true,
    isWorking: false,
    hasInvalidCustomOrderTypes: false,
    toggleSelection: jest.fn(),
    updateDecision: jest.fn(),
    checkPreview,
    runImport: jest.fn(),
  } as unknown as ReturnType<typeof useCatalogueImportWorkspace>;
  const optionPrices = {
    byOwner: {},
    detailsByKey: {},
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useCatalogueOptionPrices>;

  render(<CatalogueImportGuidedReview flow={flow} optionPrices={optionPrices} locale="en" />);
  expect(screen.getByRole('heading', { name: 'catalogue_import_step_offers' })).toBeInTheDocument();
  expect(screen.queryByText('Local price is required')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_check_preview' }));
  expect(checkPreview).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Local price is required')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_edit_item' }));
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  expect(screen.queryByText('Local price is required')).not.toBeInTheDocument();
});
