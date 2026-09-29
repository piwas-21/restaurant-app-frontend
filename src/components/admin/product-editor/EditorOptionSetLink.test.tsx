import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import { useOptionSetMaterializationFeature } from '@/hooks/admin/useOptionSetMaterializationFeature';
import { applyOptionSetAttachments, previewOptionSetAttachments } from '@/services/optionSetService';
import type { OptionSetDetail } from '@/types/optionSet';
import EditorOptionSetLink from './EditorOptionSetLink';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/admin/useOptionSetMaterializationFeature', () => ({
  useOptionSetMaterializationFeature: jest.fn(),
}));
jest.mock('@/services/optionSetService', () => ({
  applyOptionSetAttachments: jest.fn(),
  previewOptionSetAttachments: jest.fn(),
}));

const set: OptionSetDetail = {
  id: 'set-1',
  kind: 'suggestedSide',
  name: 'Sides',
  status: 'active',
  version: 2,
  entryCount: 1,
  attachmentCount: 0,
  attachments: [],
  entries: [
    {
      id: 'entry-1',
      name: 'Fries',
      productId: 'fries',
      displayOrder: 0,
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
const product = { id: 'item-1', name: 'Burger' } as ProductDetails;
const feature = jest.mocked(useOptionSetMaterializationFeature);
const preview = jest.mocked(previewOptionSetAttachments);
const apply = jest.mocked(applyOptionSetAttachments);

beforeEach(() => {
  jest.clearAllMocks();
  feature.mockReturnValue({ enabled: true, isLoading: false, error: false, reload: jest.fn() });
  preview.mockResolvedValue({
    optionSetId: set.id,
    setVersion: set.version,
    relatedOfferWarnings: [],
    targets: [
      {
        targetKey: 'suggestedSide:item-1:root',
        targetProductId: product.id,
        status: 'ready',
        conflicts: [],
        changes: [
          {
            entryId: 'entry-1',
            rowType: 'ProductSideItem',
            action: 'add',
            changedFields: [],
            preservedFields: [],
          },
        ],
        currentSettings: {},
        proposedSettings: {},
        changedSettings: [],
      },
    ],
  });
  apply.mockResolvedValue({
    optionSetId: set.id,
    setVersion: set.version,
    targets: [
      {
        targetKey: 'suggestedSide:item-1:root',
        status: 'applied',
        appliedRows: [{ entryId: 'entry-1', rowType: 'ProductSideItem', rowId: 'side-1', action: 'add' }],
        conflicts: [],
      },
    ],
  });
});

it('keeps linked attachment unavailable when the tenant flag is off', () => {
  feature.mockReturnValue({ enabled: false, isLoading: false, error: false, reload: jest.fn() });
  render(<EditorOptionSetLink set={set} product={product} isDirty={false} onApplied={jest.fn()} />);
  expect(screen.queryByText('editor_option_set_link_title')).not.toBeInTheDocument();
});

it('requires saving editor changes before a linked preview', () => {
  render(<EditorOptionSetLink set={set} product={product} isDirty onApplied={jest.fn()} />);
  fireEvent.click(screen.getByText('editor_option_set_link_title'));
  expect(screen.getByText('editor_option_set_link_save_first')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'option_set_preview_title' })).toBeDisabled();
  expect(preview).not.toHaveBeenCalled();
});

it('previews the saved row diff before applying and reloading the editor', async () => {
  const onApplied = jest.fn();
  render(<EditorOptionSetLink set={set} product={product} isDirty={false} onApplied={onApplied} />);
  fireEvent.click(screen.getByText('editor_option_set_link_title'));
  fireEvent.click(screen.getByRole('button', { name: 'option_set_preview_title' }));
  await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
  expect(preview.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      expectedSetVersion: 2,
      targets: [
        expect.objectContaining({
          targetProductId: 'item-1',
          role: 'suggestedSide',
          expectedAttachmentVersion: null,
          conflictPolicy: 'preserveLocal',
          entryIds: ['entry-1'],
        }),
      ],
    }),
  );
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'editor_option_set_link_title' }));
  await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][1]).toEqual(preview.mock.calls[0][1]);
});

it('requires an explanation when the server finds a related-offer difference', async () => {
  preview.mockResolvedValueOnce({
    optionSetId: set.id,
    setVersion: set.version,
    relatedOfferWarnings: [
      {
        targetKey: 'suggestedSide:item-1:root',
        relatedProductId: 'menu-1',
        relatedProductName: 'Menu Burger',
        relatedOfferType: 'menu',
        relatedTargetRole: 'bundleChoice',
        reasonRequired: true,
      },
    ],
    targets: [
      {
        targetKey: 'suggestedSide:item-1:root',
        targetProductId: product.id,
        status: 'ready',
        conflicts: [],
        changes: [],
        currentSettings: {},
        proposedSettings: {},
        changedSettings: [],
      },
    ],
  });
  render(<EditorOptionSetLink set={set} product={product} isDirty={false} onApplied={jest.fn()} />);
  fireEvent.click(screen.getByText('editor_option_set_link_title'));
  fireEvent.click(screen.getByRole('button', { name: 'option_set_preview_title' }));
  const applyButton = await screen.findByRole('button', { name: 'editor_option_set_link_title' });
  expect(applyButton).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'option_set_difference_reason' }), {
    target: { value: 'This item has a separate side offer.' },
  });
  fireEvent.click(applyButton);
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
  expect(apply.mock.calls[0][1].targets[0].intentionalDifferenceReason).toBe('This item has a separate side offer.');
});

it('blocks apply if the editor becomes dirty after preview', async () => {
  const onApplied = jest.fn();
  const { rerender } = render(
    <EditorOptionSetLink set={set} product={product} isDirty={false} onApplied={onApplied} />,
  );
  fireEvent.click(screen.getByText('editor_option_set_link_title'));
  fireEvent.click(screen.getByRole('button', { name: 'option_set_preview_title' }));
  expect(await screen.findByRole('button', { name: 'editor_option_set_link_title' })).toBeEnabled();
  rerender(<EditorOptionSetLink set={set} product={product} isDirty onApplied={onApplied} />);
  expect(screen.getByRole('button', { name: 'editor_option_set_link_title' })).toBeDisabled();
  expect(apply).not.toHaveBeenCalled();
});

it('holds a pending modal over the editor during apply so another edit cannot start', async () => {
  let rejectApply: (reason: Error) => void = () => {};
  apply.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectApply = reject;
    }),
  );
  render(<EditorOptionSetLink set={set} product={product} isDirty={false} onApplied={jest.fn()} />);
  fireEvent.click(screen.getByText('editor_option_set_link_title'));
  fireEvent.click(screen.getByRole('button', { name: 'option_set_preview_title' }));
  fireEvent.click(await screen.findByRole('button', { name: 'editor_option_set_link_title' }));
  const dialog = await screen.findByRole('dialog', { name: 'editor_option_set_link_title' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  expect(screen.getByRole('button', { name: 'close' })).toBeDisabled();
  await act(async () => rejectApply(new Error('offline')));
  expect(screen.queryByRole('dialog', { name: 'editor_option_set_link_title' })).not.toBeInTheDocument();
});

it('names material price and choice-rule changes before apply', async () => {
  const sauceSet: OptionSetDetail = {
    ...set,
    kind: 'sauce',
    entries: [
      {
        ...set.entries[0],
        productId: undefined,
        globalIngredientId: 'ingredient-1',
        price: 0.75,
        isOptional: false,
      },
    ],
  };
  preview.mockResolvedValueOnce({
    optionSetId: sauceSet.id,
    setVersion: sauceSet.version,
    relatedOfferWarnings: [],
    targets: [
      {
        targetKey: 'sauce:item-1:root',
        targetProductId: product.id,
        status: 'ready',
        conflicts: [],
        currentSettings: {},
        proposedSettings: {},
        changedSettings: [],
        changes: [
          {
            entryId: 'entry-1',
            rowType: 'ProductIngredient',
            action: 'update',
            changedFields: ['price', 'isOptional'],
            preservedFields: ['name'],
          },
        ],
      },
    ],
  });
  render(<EditorOptionSetLink set={sauceSet} product={product} isDirty={false} onApplied={jest.fn()} />);
  fireEvent.click(screen.getByText('editor_option_set_link_title'));
  fireEvent.click(screen.getByRole('button', { name: 'option_set_preview_title' }));
  expect(await screen.findByText(/option_set_entry_price.*0[.,]75/)).toBeInTheDocument();
  expect(screen.getByText(/ingredient_is_optional.*no/)).toBeInTheDocument();
  expect(screen.getByText(/editor_option_set_link_preserved.*option_set_entry_name/)).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});
