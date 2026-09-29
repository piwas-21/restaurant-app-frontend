import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMenuAuthoringSearch } from '@/hooks/admin/useMenuAuthoringSearch';
import type { CatalogueImportSessionItem } from '@/services/catalogueImportService';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import CatalogueImportLocalMatchSearch from './CatalogueImportLocalMatchSearch';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/admin/useMenuAuthoringSearch', () => ({ useMenuAuthoringSearch: jest.fn() }));

const bundle: CatalogueImportSessionItem = {
  templateId: 'bundle-1',
  revision: 1,
  type: 'bundle',
  displayName: 'Meal',
  description: null,
  contentHash: 'hash',
  isRoot: true,
  isSelectable: true,
  isSelected: true,
  selectionRole: 'root',
  status: 'Pending',
  localEntityType: null,
  localEntityId: null,
  failureCode: null,
  decision: null,
};

it('offers only matching tenant records and returns the chosen stable ID', () => {
  const onChoose = jest.fn();
  const setQuery = jest.fn();
  jest.mocked(useMenuAuthoringSearch).mockReturnValue({
    query: 'Meal',
    setQuery,
    items: [
      {
        id: 'bundle-local',
        type: 'bundle',
        name: 'Meal',
        matchSource: 'name',
        isComponent: false,
        isActive: true,
        isAvailable: true,
      },
      {
        id: 'product-local',
        type: 'product',
        name: 'Meal component',
        matchSource: 'name',
        isComponent: false,
        isActive: true,
        isAvailable: true,
      },
    ],
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    loadMore: jest.fn(),
    retry: jest.fn(),
  });
  render(<CatalogueImportLocalMatchSearch item={bundle} onChoose={onChoose} />);
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_find_local' }));

  expect(screen.getByText('Meal')).toBeInTheDocument();
  expect(screen.queryByText('Meal component')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_use_local' }));
  expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: 'bundle-local', type: 'bundle' }));
});

it('can reuse an internal component for an item template', () => {
  jest.mocked(useMenuAuthoringSearch).mockReturnValue({
    query: 'Side',
    setQuery: jest.fn(),
    items: [
      {
        id: 'component-local',
        type: 'component',
        name: 'Side',
        matchSource: 'name',
        isComponent: true,
        isActive: true,
        isAvailable: true,
      },
    ],
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    loadMore: jest.fn(),
    retry: jest.fn(),
  });
  const onChoose = jest.fn();
  render(<CatalogueImportLocalMatchSearch item={{ ...bundle, type: 'item' }} onChoose={onChoose} />);
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_find_local' }));
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_use_local' }));
  expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: 'component-local', type: 'component' }));
});

it('searches compatible tenant sauces for an ingredient dependency', () => {
  const onChoose = jest.fn();
  jest.mocked(useMenuAuthoringSearch).mockReturnValue({
    query: 'Samouraï',
    setQuery: jest.fn(),
    items: [
      {
        id: 'sauce-local',
        type: 'ingredient',
        name: 'Samouraï',
        matchSource: 'name',
        isComponent: false,
        isActive: true,
        isAvailable: true,
      },
      {
        id: 'set-local',
        type: 'optionSet',
        name: 'Samouraï set',
        matchSource: 'name',
        isComponent: false,
        isActive: true,
        isAvailable: true,
      },
    ],
    nextCursor: 'more',
    isLoading: false,
    isLoadingMore: false,
    error: null,
    loadMore: jest.fn(),
    retry: jest.fn(),
  });
  const detail = { type: 'ingredient', payload: { role: 'sauce' } } as CatalogueTemplateRevision;
  render(
    <CatalogueImportLocalMatchSearch item={{ ...bundle, type: 'ingredient' }} detail={detail} onChoose={onChoose} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_find_local' }));

  expect(useMenuAuthoringSearch).toHaveBeenCalledWith('sauce');
  expect(screen.getByText('Samouraï')).toBeInTheDocument();
  expect(screen.queryByText('Samouraï set')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_use_local' }));
  expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: 'sauce-local', type: 'ingredient' }));
});

it('searches compatible tenant option sets and keeps pagination', () => {
  const loadMore = jest.fn();
  jest.mocked(useMenuAuthoringSearch).mockReturnValue({
    query: 'Meat',
    setQuery: jest.fn(),
    items: [
      {
        id: 'set-local',
        type: 'optionSet',
        name: 'Meat choices',
        matchSource: 'name',
        isComponent: false,
        isActive: true,
        isAvailable: true,
      },
    ],
    nextCursor: 'more',
    isLoading: false,
    isLoadingMore: false,
    error: null,
    loadMore,
    retry: jest.fn(),
  });
  const detail = { type: 'option-set', payload: { kind: 'bundle-option' } } as CatalogueTemplateRevision;
  render(
    <CatalogueImportLocalMatchSearch item={{ ...bundle, type: 'option-set' }} detail={detail} onChoose={jest.fn()} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'catalogue_import_find_local' }));

  expect(useMenuAuthoringSearch).toHaveBeenCalledWith('bundleChoice');
  expect(screen.getByText('Meat choices')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'load_more' }));
  expect(loadMore).toHaveBeenCalledTimes(1);
});
