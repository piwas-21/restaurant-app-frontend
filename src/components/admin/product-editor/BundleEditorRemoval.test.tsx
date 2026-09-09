import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductEditorPage from './ProductEditorPage';
import { EMPTY_MENU_DEFINITION } from '@/utils/productEditorDefaults';
import { updateMenuBundle } from '@/services/menuBundleService';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * The owner's bug report on the bundle edit page: "remove section" and "remove item from
 * section" do nothing when clicked.
 *
 * What was actually wrong, reproduced against a real browser before this suite existed: the
 * row buttons in `MenuItemSelector` (move ↑/↓, remove ×) carried no `type`, so they defaulted
 * to `type="submit"` inside the editor's page-wide `<form>`. Clicking "Remove item" therefore
 * SUBMITTED the bundle — a silent PUT plus a refetch that remounts the editor — and the
 * confirmation never survived; the row came back and the admin read it as "nothing happened".
 * `ConfirmationModal`'s own buttons were typed for exactly this reason (see its comment); the
 * rows it is opened from were missed.
 *
 * These tests pin, at the page the owner uses:
 *   1. a bare row-button click NEVER saves (`updateMenuBundle` untouched),
 *   2. the confirmation opens, and confirming propagates the removal,
 *   3. the ONE Save carries the removal to the bundle endpoint — exactly once, no phantom.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
  updateProductImageDetails: jest.fn(async () => ({ success: true })),
  deleteProductImage: jest.fn(async () => ({ success: true })),
  searchProducts: jest.fn(async () => ({ success: true, data: { items: [] } })),
}));
jest.mock('@/services/menuService', () => ({ createProduct: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({
  createMenuBundle: jest.fn(),
  updateMenuBundle: jest.fn(async () => ({ success: true, data: 'ok' })),
}));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-a', name: 'Pizza' }] } })),
}));

const mockUpdateMenuBundle = updateMenuBundle as jest.Mock;

const bundle: ProductDetails = {
  id: 'bundle-1',
  name: 'Pizza Combo',
  description: 'A combo',
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 10,
  type: 'menu',
  ingredients: [],
  allergens: [],
  categories: [],
  variations: [],
  images: [],
  suggestedSideItems: [],
  content: {},
  menuDefinition: {
    ...EMPTY_MENU_DEFINITION,
    id: 'md-1',
    sections: [
      {
        id: 'sec-mains',
        name: 'Mains',
        description: '',
        displayOrder: 0,
        isRequired: true,
        minSelection: 1,
        maxSelection: 2,
        items: [
          { id: 'item-1', productId: 'p1', productName: 'Kebab', additionalPrice: 0, displayOrder: 0, isDefault: true },
          {
            id: 'item-2',
            productId: 'p2',
            productName: 'Fries',
            additionalPrice: 0,
            displayOrder: 1,
            isDefault: false,
          },
        ],
      },
      {
        id: 'sec-drinks',
        name: 'Drinks',
        description: '',
        displayOrder: 1,
        isRequired: false,
        minSelection: 0,
        maxSelection: 1,
        items: [],
      },
    ],
  },
} as unknown as ProductDetails;

const renderBundleEditor = async () => {
  render(
    <ProductEditorPage
      product={bundle}
      isBundle={true}
      mode="edit"
      onSaved={jest.fn()}
      onDelete={jest.fn()}
      onBack={jest.fn()}
    />,
  );
  await act(async () => {});
};

const sectionCard = (name: string) => screen.getByText(name).closest('div[class*="sectionCard"]') as HTMLElement;

/** One dirtying change so the page's Save (gated on isDirty in edit mode) is armed. */
const dirtyForm = () => {
  fireEvent.change(screen.getByLabelText('menu_bundle_name'), { target: { value: 'Pizza Combo XL' } });
};

describe('bundle edit page — removing from Menu Sections (owner bug report)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a bare "remove item" click asks for confirmation and never saves', async () => {
    await renderBundleEditor();

    fireEvent.click(within(sectionCard('Mains')).getByTitle('expand'));
    const kebabRow = screen.getByText('Kebab').closest('tr') as HTMLElement;
    fireEvent.click(within(kebabRow).getByTitle('remove_item'));

    expect(screen.getByText('Are you sure you want to remove this item?')).toBeInTheDocument();
    // THE regression: the row button used to submit the whole bundle form — a silent save
    // behind the admin's back, before they had confirmed anything.
    expect(mockUpdateMenuBundle).not.toHaveBeenCalled();
  });

  it('confirming the item removal removes the row, and the one Save carries it exactly once', async () => {
    await renderBundleEditor();

    fireEvent.click(within(sectionCard('Mains')).getByTitle('expand'));
    const kebabRow = screen.getByText('Kebab').closest('tr') as HTMLElement;
    fireEvent.click(within(kebabRow).getByTitle('remove_item'));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    expect(screen.queryByText('Kebab')).not.toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
    expect(mockUpdateMenuBundle).not.toHaveBeenCalled();

    dirtyForm();
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() => expect(mockUpdateMenuBundle).toHaveBeenCalledTimes(1));
    const payload = mockUpdateMenuBundle.mock.calls[0][1];
    const sections = payload.menuDefinition?.sections ?? payload.menuDefinition?.Sections;
    expect(sections[0].items).toHaveLength(1);
    // The wire shape strips productName; the surviving item is the one NOT removed.
    expect(sections[0].items[0].productId).toBe('p2');
  });

  it('a bare "delete section" click asks for confirmation and never saves', async () => {
    await renderBundleEditor();

    fireEvent.click(within(sectionCard('Mains')).getByTitle('delete_section'));

    expect(screen.getByText('Are you sure you want to delete this section?')).toBeInTheDocument();
    expect(mockUpdateMenuBundle).not.toHaveBeenCalled();
  });

  it('confirming the section removal removes the card, and the one Save carries it exactly once', async () => {
    await renderBundleEditor();

    fireEvent.click(within(sectionCard('Mains')).getByTitle('delete_section'));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    expect(screen.queryByText('Mains')).not.toBeInTheDocument();
    expect(screen.getByText('Drinks')).toBeInTheDocument();
    expect(mockUpdateMenuBundle).not.toHaveBeenCalled();

    dirtyForm();
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() => expect(mockUpdateMenuBundle).toHaveBeenCalledTimes(1));
    const payload = mockUpdateMenuBundle.mock.calls[0][1];
    const sections = payload.menuDefinition?.sections ?? payload.menuDefinition?.Sections;
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('Drinks');
  });
});
