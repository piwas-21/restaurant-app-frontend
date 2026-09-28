import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { OptionSetDetail } from '@/types/optionSet';
import { getOptionSet, searchOptionSets } from '@/services/optionSetService';
import EditorOptionSetPicker from './EditorOptionSetPicker';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock('@/services/optionSetService', () => ({ getOptionSet: jest.fn(), searchOptionSets: jest.fn() }));

const detail: OptionSetDetail = {
  id: 'set-1',
  name: 'Sides',
  kind: 'suggestedSide',
  status: 'active',
  version: 1,
  entryCount: 1,
  attachmentCount: 0,
  attachments: [],
  entries: [
    {
      id: 'entry-1',
      name: 'Fries',
      displayOrder: 0,
      productId: 'fries',
      isOptional: true,
      maxQuantity: 1,
      price: 0,
      isIncludedInBasePrice: false,
      isRequired: false,
      additionalPrice: 0,
      isDefault: false,
    },
  ],
};

function draft() {
  return {
    selectedSideItemIds: [],
    changeSideItemIds: jest.fn(),
  } as unknown as ReturnType<typeof useProductEditorForm>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(searchOptionSets).mockResolvedValue({ items: [detail], nextCursor: null });
  jest.mocked(getOptionSet).mockResolvedValue(detail);
});

it('shows loading, then lists active sets for the selected section', async () => {
  let finish: (value: { items: OptionSetDetail[]; nextCursor: null }) => void = () => {};
  jest.mocked(searchOptionSets).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<EditorOptionSetPicker editor={draft()} isBundle={false} kinds={['suggestedSide']} />);
  expect(screen.getByText('loading')).toBeInTheDocument();
  finish({ items: [detail], nextCursor: null });
  expect(await screen.findByRole('button', { name: 'editor_option_set_preview' })).toBeInTheDocument();
  expect(searchOptionSets).toHaveBeenCalledWith(
    { kind: 'suggestedSide', query: '', limit: 24 },
    expect.any(AbortSignal),
  );
});

it('shows a request failure instead of an empty-library message', async () => {
  jest.mocked(searchOptionSets).mockRejectedValue(new Error('offline'));
  render(<EditorOptionSetPicker editor={draft()} isBundle={false} kinds={['suggestedSide']} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('option_set_load_error');
  expect(screen.queryByText('editor_option_sets_empty')).not.toBeInTheDocument();
});

it('previews entries before adding a local copy to the unsaved draft', async () => {
  const editor = draft();
  render(<EditorOptionSetPicker editor={editor} isBundle={false} kinds={['suggestedSide']} />);
  fireEvent.click(await screen.findByRole('button', { name: 'editor_option_set_preview' }));
  expect(await screen.findByText('Fries')).toBeInTheDocument();
  expect(editor.changeSideItemIds).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'editor_option_set_apply' }));
  await waitFor(() => expect(editor.changeSideItemIds).toHaveBeenCalledWith(['fries']));
  expect(screen.getByText('editor_option_set_applied')).toBeInTheDocument();
});
