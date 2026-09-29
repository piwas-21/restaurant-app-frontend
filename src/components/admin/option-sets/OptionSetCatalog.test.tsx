import React from 'react';
import { render, screen } from '@testing-library/react';
import type { OptionSetSummary } from '@/types/optionSet';
import OptionSetCatalog from './OptionSetCatalog';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockCatalog = {
  query: '',
  setQuery: jest.fn(),
  kind: '',
  setKind: jest.fn(),
  items: [] as OptionSetSummary[],
  nextCursor: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,
  loadMore: jest.fn(),
  retry: jest.fn(),
};
jest.mock('@/hooks/admin/useOptionSetCatalog', () => ({ useOptionSetCatalog: () => mockCatalog }));

beforeEach(() => {
  mockCatalog.query = '';
  mockCatalog.kind = '';
  mockCatalog.items = [];
});

it('offers each set type directly and gives a first-time tenant a next step', () => {
  render(<OptionSetCatalog />);

  const types = {
    ingredient: 'option_set_kind_Ingredient',
    sauce: 'option_set_kind_Sauce',
    bundleChoice: 'option_set_kind_BundleChoice',
    suggestedSide: 'option_set_kind_SuggestedSide',
  };
  for (const [kind, label] of Object.entries(types)) {
    expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute(
      'href',
      `/admin/option-sets/new?kind=${kind}`,
    );
  }
  expect(screen.getByText('option_sets_empty_first')).toBeInTheDocument();
});

it('keeps saved sets editable and distinguishes a filtered empty result', () => {
  mockCatalog.query = 'sauce';
  mockCatalog.items = [
    {
      id: 'set-1',
      kind: 'sauce',
      name: 'House sauces',
      status: 'active',
      version: 1,
      entryCount: 2,
      attachmentCount: 1,
    },
  ];
  const view = render(<OptionSetCatalog />);
  expect(screen.getByRole('link', { name: 'House sauces' })).toHaveAttribute('href', '/admin/option-sets/set-1');
  expect(screen.getByText('option_sets_saved_heading')).toBeInTheDocument();

  mockCatalog.items = [];
  view.rerender(<OptionSetCatalog />);
  expect(screen.getByText('option_sets_empty')).toBeInTheDocument();
  expect(screen.queryByText('option_sets_empty_first')).not.toBeInTheDocument();
});
