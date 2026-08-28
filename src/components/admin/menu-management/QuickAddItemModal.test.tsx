import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickAddItemModal from './QuickAddItemModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/menuService', () => ({
  createProduct: jest.fn(async () => ({ success: true, data: { id: 'new-item-1' } })),
}));
jest.mock('@/services/menuBundleService', () => ({
  createMenuBundle: jest.fn(),
  updateMenuBundle: jest.fn(),
}));
jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(),
  uploadBulkProductImages: jest.fn(),
}));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({
    success: true,
    data: {
      items: [
        { id: 'cat-a', name: 'Pizzas' },
        { id: 'cat-b', name: 'Sides' },
      ],
    },
  })),
}));

import { createProduct } from '@/services/menuService';
import { getCategories } from '@/services/categoryService';
import { ApiError } from '@/utils/apiClient';

const renderModal = async (overrides: Partial<React.ComponentProps<typeof QuickAddItemModal>> = {}) => {
  const props = {
    isOpen: true,
    onClose: jest.fn(),
    onCreated: jest.fn(),
    onAddedAnother: jest.fn(),
    ...overrides,
  };
  const view = render(<QuickAddItemModal {...props} />);
  // The category fetch resolves after mount; flush it so the state update lands inside act().
  await act(async () => {});
  return { ...view, ...props };
};

const fill = (name: string, price: string, categoryId: string) => {
  fireEvent.change(screen.getByLabelText('item_name'), { target: { value: name } });
  // `/price/` and not 'price': the wrapping label also holds the CHF suffix (aria-hidden, so a
  // screen reader still hears just the label — RTL's label query reads raw text).
  fireEvent.change(screen.getByLabelText(/price/), { target: { value: price } });
  fireEvent.change(screen.getByLabelText('category'), { target: { value: categoryId } });
};

/**
 * The quick-add create modal (MENU-ITEM-EDITOR-REDESIGN-PLAN, slice S3 / decision D3).
 *
 * `schemas.quickAdd.test.ts` proves the modal cannot ask a different question from the full
 * editor; this proves the surface: three fields, the editor's own refusals, one POST, and the
 * item's own edit page at the end of it.
 */
describe('QuickAddItemModal — create is three fields and a redirect (D3)', () => {
  // Call counts only — `clearAllMocks` keeps each factory's own implementation, so the default
  // "created, id new-item-1" answer survives while `not.toHaveBeenCalled()` stays honest.
  beforeEach(() => jest.clearAllMocks());

  it('asks for exactly name, price and category — nothing else', async () => {
    await renderModal();
    // `BaseModal` portals to document.body, so the dialog — not the render container — is the tree.
    const dialog = screen.getByRole('dialog');

    expect(screen.getByLabelText('item_name')).toBeInTheDocument();
    expect(screen.getByLabelText(/price/)).toBeInTheDocument();
    expect(screen.getByLabelText('category')).toBeInTheDocument();
    // Three controls, and no fourth: the editor's own description, allergens, variations and —
    // the divergence D3 deletes — its create-only staged image input.
    expect(dialog.querySelectorAll('input, select, textarea')).toHaveLength(2 + 1);
    expect(dialog.querySelector('input[type="file"]')).toBeNull();
    expect(dialog.querySelector('textarea')).toBeNull();
  });

  // The currency is the tenant's, from config. The approved screen draws `$`, which is wrong for a
  // Swiss tenant and would be wrong for the next one too (handover §3).
  it('shows the tenant currency beside the price, never a hardcoded symbol', async () => {
    await renderModal();

    expect(screen.getByRole('dialog').textContent).toContain('CHF');
    expect(screen.getByRole('dialog').textContent).not.toContain('$');
  });

  it('refuses an empty form with the full editor’s own messages, and posts nothing', async () => {
    await renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'quick_add_save_and_open' }));

    expect(await screen.findByText('Select at least one category')).toBeInTheDocument();
    expect(screen.getByText('String must contain at least 1 character(s)')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('POSTs the full create payload and hands back the new id', async () => {
    const { onCreated } = await renderModal();

    fill('Margherita', '14.5', 'cat-a');
    fireEvent.click(screen.getByRole('button', { name: 'quick_add_save_and_open' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledWith('new-item-1');

    const payload = (createProduct as jest.Mock).mock.calls[0][0];
    // The three answers, and the ONE select that stands for both category fields.
    expect(payload).toMatchObject({
      name: 'Margherita',
      basePrice: 14.5,
      categoryIds: ['cat-a'],
      primaryCategoryId: 'cat-a',
      // Everything the modal never asked about, sent anyway (plan §6: an omitted field is a
      // cleared column). These four are assigned unconditionally by the create command.
      type: 'mainItem',
      kitchenType: 'None',
      hideBaseProduct: false,
      availableOrderTypes: null,
    });
    // …and the admin's current language seeded exactly as the full create form seeded it.
    expect(payload.content).toEqual({ en: { name: 'Margherita', description: '' } });
  });

  // D3: "Enter saves and re-opens the modal empty, because menu entry is a batch task." So the
  // FORM's submit is `Save and add another`, not the primary button — pressing Enter in the name
  // field must not navigate away mid-menu.
  it('saves and stays empty on Enter, leaving the caller to refresh the list', async () => {
    const { onCreated, onAddedAnother } = await renderModal();

    fill('Pepperoni', '16', 'cat-a');
    fireEvent.submit(screen.getByLabelText('item_name').closest('form') as HTMLFormElement);

    await waitFor(() => expect(onAddedAnother).toHaveBeenCalledTimes(1));
    expect(onCreated).not.toHaveBeenCalled();
    await waitFor(() => expect((screen.getByLabelText('item_name') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('category') as HTMLSelectElement).value).toBe('');
  });

  it('binds Enter to the same button it labels', async () => {
    await renderModal();

    const addAnother = screen.getByRole('button', { name: /quick_add_save_and_another/ });
    expect(addAnother).toHaveAttribute('type', 'submit');
    expect(addAnother).toHaveAttribute('aria-keyshortcuts', 'Enter');
    // The primary is deliberately NOT the form's default submit.
    expect(screen.getByRole('button', { name: 'quick_add_save_and_open' })).toHaveAttribute('type', 'button');
  });

  it('surfaces a refused create instead of closing over it', async () => {
    (createProduct as jest.Mock).mockResolvedValueOnce({ success: false, message: 'Name already exists' });
    const { onCreated } = await renderModal();

    fill('Margherita', '14.5', 'cat-a');
    fireEvent.click(screen.getByRole('button', { name: 'quick_add_save_and_open' }));

    expect(await screen.findByText('Name already exists')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  // Same defect, same sentence, as the editor's chip group: an empty control is indistinguishable
  // from a tenant with no categories, on a surface whose next action is Save.
  it('says why the category list is empty when the fetch fails', async () => {
    (getCategories as jest.Mock).mockRejectedValueOnce(new ApiError(503, 'Category service is warming up'));

    await renderModal();

    expect(await screen.findByTestId('quick-add-categories-error')).toHaveTextContent('Category service is warming up');
  });

  // Clearing the select must clear BOTH fields, or a stale `categoryIds` would submit a category
  // the admin has just deselected.
  it('clears both category fields when the select goes back to empty', async () => {
    await renderModal();

    fill('Margherita', '14.5', 'cat-a');
    fireEvent.change(screen.getByLabelText('category'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'quick_add_save_and_open' }));

    expect(await screen.findByText('Select at least one category')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('tells the admin where the rest of the item is entered', async () => {
    await renderModal();

    expect(screen.getByText('quick_add_item_hint')).toBeInTheDocument();
  });
});
