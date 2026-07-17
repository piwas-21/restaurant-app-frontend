import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductEditorPage from './ProductEditorPage';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import { EMPTY_MENU_DEFINITION } from '@/utils/productEditorDefaults';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/services/menuService', () => ({
  createProduct: jest.fn(),
  createMenuBundle: jest.fn(),
  updateMenuBundle: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-a', name: 'Pizza' }] } })),
}));

import { updateProduct } from '@/services/productService';
import { updateMenuBundle } from '@/services/menuService';

const item: ProductDetails = {
  id: 'item-1',
  name: 'Margherita',
  description: 'A pizza',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 10,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [{ categoryId: 'cat-a', categoryName: 'Pizza', isPrimary: true }],
  primaryCategory: { id: 'cat-a', name: 'Pizza' },
  variations: [],
  images: [],
  suggestedSideItems: [],
  content: { en: { name: 'Margherita', description: 'A pizza' } },
} as ProductDetails;

const bundle: ProductDetails = {
  ...item,
  id: 'bundle-1',
  name: 'Pizza Combo',
  type: 'menu',
  basePrice: 20,
  categories: [],
  primaryCategory: undefined,
  menuDefinition: {
    ...EMPTY_MENU_DEFINITION,
    id: 'md-1',
    sections: [
      {
        id: 'temp-99',
        name: 'Drink',
        displayOrder: 0,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [{ id: 'temp-1', productId: 'p9', additionalPrice: 0, displayOrder: 0, isDefault: true }],
      },
    ],
  },
} as ProductDetails;

const renderEditor = async (product: ProductDetails, isBundle: boolean) => {
  const onSaved = jest.fn();
  const onBack = jest.fn();
  const { container } = render(
    <ProductEditorPage product={product} isBundle={isBundle} onSaved={onSaved} onDelete={jest.fn()} onBack={onBack} />,
  );
  // The categories fetch resolves after mount; flush it so that state update lands inside
  // act() rather than warning.
  await act(async () => {});
  // The product's own name field, not the same-valued `content.0.name` translation row —
  // ProductBasicInfo's input carries no label to query by.
  const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
  return { onSaved, onBack, nameInput };
};

beforeEach(() => jest.clearAllMocks());

describe('ProductEditorPage — type is a derived badge, not a chooser', () => {
  // The backend has no item<->bundle migration (a bundle needs a MenuDefinition), so a type
  // control would promise a failure. Owner call, plan §7.
  it('shows the type as a badge and offers no way to change it', async () => {
    await renderEditor(bundle, true);

    expect(screen.getByTestId('product-type-badge')).toHaveTextContent('product_type_menu');
    // The item form's type <select> renders the productTypes as <option>s (mainItem, beverage,
    // …). Assert none of those option values exist — a bundle must offer no way to change type.
    // queryByLabelText('product_type') would be a no-op here: ProductDetails' label has no
    // htmlFor, so it associates with nothing and the query is null whether or not the select
    // rendered. This checks the actual control.
    expect(screen.queryByRole('option', { name: 'product_type_mainItem' })).not.toBeInTheDocument();
  });

  it('derives the badge from the product type for a plain item', async () => {
    await renderEditor(item, false);

    expect(screen.getByTestId('product-type-badge')).toHaveTextContent('product_type_mainItem');
  });
});

describe('ProductEditorPage — the panels each kind can actually support', () => {
  // Not cosmetic: MenuBundleDto returns no categories/variations/ingredients, so these
  // controls would have nothing to seed from and their values would be invented.
  it('gives a bundle the schedule and sections, and no category/variation controls', async () => {
    await renderEditor(bundle, true);

    expect(screen.getByText('menu_availability_schedule')).toBeInTheDocument();
    expect(screen.getByText('menu_sections')).toBeInTheDocument();
    expect(screen.queryByText('categories')).not.toBeInTheDocument();
    expect(screen.queryByText('product_variations')).not.toBeInTheDocument();
  });

  it('gives an item the category controls, and no bundle schedule', async () => {
    await renderEditor(item, false);

    expect(screen.getByText('categories')).toBeInTheDocument();
    expect(screen.queryByText('menu_availability_schedule')).not.toBeInTheDocument();
    expect(screen.queryByText('menu_sections')).not.toBeInTheDocument();
  });
});

describe('ProductEditorPage — one Save, over the right write path', () => {
  it('disables Save until something changes, so the only commit point is deliberate', async () => {
    await renderEditor(item, false);

    expect(screen.getByRole('button', { name: 'save_changes' })).toBeDisabled();
  });

  // Ingredients are React state, not a registered RHF field, so form.isDirty can't see them.
  // Without a dedicated dirty flag an ingredient-only edit left Save disabled and stranded the
  // change — a capability the old self-saving tables had. Adding an ingredient enables Save.
  it('enables Save after an ingredient-only change', async () => {
    await renderEditor(item, false);

    expect(screen.getByRole('button', { name: 'save_changes' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'add_ingredient' }));
    expect(screen.getByRole('button', { name: 'save_changes' })).toBeEnabled();
  });

  // The owner asked for an unsaved-changes guard. Save is gated on isDirty, so Back is the
  // only silent-discard path — confirm before leaving with pending edits.
  it('leaves immediately when Back is clicked with no pending changes', async () => {
    const { onBack } = await renderEditor(item, false);

    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('confirms before discarding on Back when there are unsaved changes', async () => {
    const { onBack } = await renderEditor(item, false);

    fireEvent.click(screen.getByRole('button', { name: 'add_ingredient' }));
    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    // Not left yet — the confirm modal stands between the click and the discard.
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('discard_unsaved_changes_message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('routes an item save to the product endpoint', async () => {
    const { nameInput } = await renderEditor(item, false);

    fireEvent.change(nameInput, { target: { value: 'Margherita Bianca' } });
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect(updateMenuBundle).not.toHaveBeenCalled();
  });

  it('routes a bundle save to the bundle endpoint with temp ids stripped', async () => {
    const { nameInput } = await renderEditor(bundle, true);

    fireEvent.change(nameInput, { target: { value: 'Pizza Combo XL' } });
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(updateMenuBundle).toHaveBeenCalledTimes(1));
    expect(updateProduct).not.toHaveBeenCalled();

    const [, payload] = (updateMenuBundle as jest.Mock).mock.calls[0];
    // Assert the WIRE, not the object: the write path re-spreads each section and re-sets
    // `id`, so the key can exist holding undefined — which JSON.stringify drops anyway. What
    // matters is that no `temp-…` id reaches the server: MenuSectionItemDto.Id is Guid?, so
    // STJ fails the conversion and the request 400s. The write path strips only the SECTION
    // id, so the page must strip the nested ITEM ids itself.
    const wire = JSON.parse(JSON.stringify(payload));
    expect(JSON.stringify(wire)).not.toContain('temp-');
    expect(wire.menuDefinition.sections[0].id).toBeUndefined();
    expect(wire.menuDefinition.sections[0].items[0].id).toBeUndefined();
    expect(wire.menuDefinition.sections[0].items[0].productId).toBe('p9');
    // A REAL definition id must survive — dropping it would orphan the saved definition.
    expect(wire.menuDefinition.id).toBe('md-1');
  });

  // The other half of the same rule: an unsaved definition carries a temp id, which would
  // 400 exactly like a temp section/item id. The backend assigns the real one.
  it('drops a temporary menu-definition id, keeping a persisted one', async () => {
    const fresh = {
      ...bundle,
      menuDefinition: { ...EMPTY_MENU_DEFINITION, id: 'temp-555', sections: [] },
    } as ProductDetails;
    const { nameInput } = await renderEditor(fresh, true);

    fireEvent.change(nameInput, { target: { value: 'Brand New Combo' } });
    fireEvent.click(screen.getByRole('button', { name: 'save_changes' }));

    await waitFor(() => expect(updateMenuBundle).toHaveBeenCalledTimes(1));

    const [, payload] = (updateMenuBundle as jest.Mock).mock.calls[0];
    const wire = JSON.parse(JSON.stringify(payload));
    // null, not absent: the write path normalises a missing id to null (`id: … || null`),
    // which MenuDefinitionDto.Id (Guid?) accepts. The point is that "temp-555" never lands.
    expect(wire.menuDefinition.id).toBeNull();
    expect(JSON.stringify(wire)).not.toContain('temp-');
  });
});
