import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ProductEditorPage from './ProductEditorPage';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) =>
      typeof options === 'object' && options !== null && 'count' in options
        ? `${key}:${(options as { count: number }).count}`
        : key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
  updateProductImageDetails: jest.fn(async () => ({ success: true })),
  deleteProductImage: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/services/menuService', () => ({ createProduct: jest.fn(async () => ({ success: true })) }));
jest.mock('@/services/menuBundleService', () => ({
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

/**
 * A product **exactly as the API sends it**, nulls and all.
 *
 * `ProductVariationDto.Description`, `ProductVariationContentDto.Description` and
 * `ProductDescriptionDto.Description` are all `string?` in C#, and System.Text.Json writes an
 * absent one as an explicit `null` — verified against the projection in
 * `GetProductByIdQuery.cs:173`. `toItemDefaults` seeds the form from that response verbatim, so
 * these nulls are what the resolver really validated in production.
 */
const item = {
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
  variations: [
    { id: 'v1', name: 'Large', description: null, priceModifier: 2, isActive: true, displayOrder: 0, content: {} },
    {
      id: 'v2',
      name: 'Small',
      description: null,
      priceModifier: -2,
      isActive: true,
      displayOrder: 1,
      // A locale that carries a NAME and no description — the path with no input of its own.
      content: { fr: { name: 'Petite', description: null } },
    },
  ],
  images: [],
  suggestedSideItems: [],
  content: { en: { name: 'Margherita', description: null } },
} as unknown as ProductDetails;

const renderEditor = async () => {
  const view = render(<ProductEditorPage product={item} isBundle={false} onSaved={jest.fn()} onBack={jest.fn()} />);
  await act(async () => {});
  return view;
};

const save = async () => {
  fireEvent.click(screen.getByTestId('editor-save'));
  await act(async () => {});
};

/**
 * **The production defect of 2026-08-28**, reported by the owner as three symptoms and caused by
 * one thing: *"I can add a variation, but when I delete one the page refreshes and the deleted one
 * comes back"*, *"editing any field shows `Fields to fix: 1 — jump to first` and clicking it goes
 * nowhere"*, and a Sauce-rules box drawn in red.
 *
 * The root cause was neither the delete nor the sauce rules. `variationSchema.description` was
 * `z.string().optional()`, which accepts `undefined` and REFUSES `null` — so a variation saved
 * without a description made the whole form invalid on a cell that rendered no message. `Save` was
 * refused before any request was built, the delete was never sent, and the next fetch put the row
 * back. The chip counted the refusal it could not show.
 *
 * These tests are written against the WIRE SHAPE, not against the schema, because that is where the
 * two disagreed: every value below is one the API really sends.
 */
describe('product editor — the nulls the API really sends (owner report 2026-08-28)', () => {
  beforeEach(() => {
    (updateProduct as jest.Mock).mockClear();
  });

  it('SAVES a product whose variations came back with a null description', async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText('product_name'), { target: { value: 'Margherita Bianca' } });

    await save();

    expect(updateProduct).toHaveBeenCalledTimes(1);
  });

  // The owner's first symptom, end to end: the delete was correct all along — the SAVE never ran.
  it('really deletes a variation, instead of a refused save putting it back', async () => {
    await renderEditor();

    fireEvent.click(screen.getAllByLabelText('remove')[0]);
    await act(async () => {});
    await save();

    expect(updateProduct).toHaveBeenCalledTimes(1);
    const [, payload] = (updateProduct as jest.Mock).mock.calls[0];
    expect(payload.variations.map((v: { id: string }) => v.id)).toEqual(['v2']);
  });

  // The second symptom. The count is the tell: one invisible failing field is what the admin was
  // being asked to fix, on a page that showed no failing field anywhere.
  it('shows no phantom failing field on a product it can save', async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText('product_name'), { target: { value: 'Margherita Bianca' } });

    await save();

    expect(screen.queryByText(/editor_error_summary/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  /**
   * The owner's third question — *"is the red Sauce rules box the cause? if so the rules should be
   * OPTIONAL"* — answered by the save itself. They already were optional and still are: this
   * product names none of the three, and the API sends none of them for any product created before
   * #588. The red box was `border: 1px solid var(--brand-primary)`, i.e. #c00000, on a valid group.
   */
  it('saves an item that sets no sauce rules at all', async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText('product_name'), { target: { value: 'Margherita Bianca' } });

    await save();

    expect(updateProduct).toHaveBeenCalledTimes(1);
    const [, payload] = (updateProduct as jest.Mock).mock.calls[0];
    // Sent, and sent as the "no rule" values — a PUT that omitted them would clear a stored rule.
    expect(payload).toMatchObject({ sauceMin: 0, sauceMax: null, sauceIncludedFree: 0 });
  });
});
