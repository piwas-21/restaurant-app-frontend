import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MenuCreateFlow from './MenuCreateFlow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
// `mock`-prefixed so the factory may close over it (jest's out-of-scope-variable rule).
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/services/menuService', () => ({
  createProduct: jest.fn(async () => ({ success: true, data: { id: 'new-item-1' } })),
}));
jest.mock('@/services/menuBundleService', () => ({ createMenuBundle: jest.fn(), updateMenuBundle: jest.fn() }));
jest.mock('@/services/productService', () => ({ updateProduct: jest.fn(), uploadBulkProductImages: jest.fn() }));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-a', name: 'Pizzas' }] } })),
}));

import { getCategories } from '@/services/categoryService';

/**
 * The trigger and the type chooser's item option carry the SAME label (`create_new_product`) —
 * they did before S3 too — so the second click is scoped to the dialog rather than to the page.
 */
const openItemModal = () => {
  fireEvent.click(screen.getByRole('button', { name: 'create_new_product' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'create_new_product' }));
};

const renderFlow = async (autoOpenQuickAdd = false) => {
  const onCreated = jest.fn();
  render(<MenuCreateFlow autoOpenQuickAdd={autoOpenQuickAdd} onCreated={onCreated} />);
  await act(async () => {});
  return { onCreated };
};

/**
 * The list page's create entry (MENU-ITEM-EDITOR-REDESIGN-PLAN, slice S3).
 *
 * The two kinds part ways here, which is the whole of S3's routing change: an ITEM is three fields
 * in a modal and then its own edit page (D3), a BUNDLE is still a page, because `MenuBundleDto`
 * carries no categories and its sections editor is the entire screen (§9.5).
 */
describe('MenuCreateFlow — an item quick-adds, a bundle still gets a page (S3)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (getCategories as jest.Mock).mockClear();
  });

  it('opens the quick-add modal for an item, and never the /new route', async () => {
    await renderFlow();

    openItemModal();
    await act(async () => {});

    expect(screen.getByRole('dialog', { name: 'quick_add_item_title' })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('still routes a bundle to its create page', async () => {
    await renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'create_new_product' }));
    fireEvent.click(screen.getByRole('button', { name: 'create_new_menu_bundle' }));

    expect(mockPush).toHaveBeenCalledWith('/admin/menu-management/new?type=menu');
    expect(screen.queryByRole('dialog', { name: 'quick_add_item_title' })).not.toBeInTheDocument();
  });

  // The create→enrich hop D3 is built for: the POST lands, and the admin is put where photos,
  // ingredients and translations actually live.
  it('lands the admin on the new item’s edit page after Save and open', async () => {
    await renderFlow(true);

    fireEvent.change(screen.getByLabelText('item_name'), { target: { value: 'Margherita' } });
    fireEvent.change(screen.getByLabelText('category'), { target: { value: 'cat-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'quick_add_save_and_open' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/menu-management/new-item-1'));
  });

  it('refreshes the list behind it when the admin saves and adds another', async () => {
    const { onCreated } = await renderFlow(true);

    fireEvent.change(screen.getByLabelText('item_name'), { target: { value: 'Pepperoni' } });
    fireEvent.change(screen.getByLabelText('category'), { target: { value: 'cat-a' } });
    fireEvent.submit(screen.getByLabelText('item_name').closest('form') as HTMLFormElement);

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'quick_add_item_title' })).toBeInTheDocument();
  });

  it('closes the quick-add modal without creating anything', async () => {
    const { onCreated } = await renderFlow(true);

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(screen.queryByRole('dialog', { name: 'quick_add_item_title' })).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // `?new=item` is where the retired item create URL sends people, so the intent survives the
  // redirect instead of dropping them on a list with nothing open.
  it('opens straight into quick-add when asked to', async () => {
    await renderFlow(true);

    expect(screen.getByRole('dialog', { name: 'quick_add_item_title' })).toBeInTheDocument();
  });

  // Mounted only while open: an admin who never creates anything must not pay for a category
  // fetch, and every opening has to start from an empty form rather than the last one's answers.
  it('fetches categories only once the item modal is open', async () => {
    await renderFlow();
    expect(getCategories).not.toHaveBeenCalled();

    openItemModal();
    await act(async () => {});

    expect(getCategories).toHaveBeenCalledTimes(1);
  });
});
