import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react';
import ProductEditorPage from './ProductEditorPage';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@/services/productService', () => ({
  updateProduct: jest.fn(async () => ({ success: true })),
  uploadBulkProductImages: jest.fn(async () => ({ success: true })),
  updateProductImageDetails: jest.fn(async () => ({ success: true })),
  deleteProductImage: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/services/menuService', () => ({ createProduct: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ createMenuBundle: jest.fn(), updateMenuBundle: jest.fn() }));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({
    success: true,
    data: {
      items: [
        { id: 'cat-pizza', name: 'Pizzas' },
        { id: 'cat-lunch', name: 'Lunch' },
      ],
    },
  })),
}));

import { updateProduct } from '@/services/productService';
import { createGlobalIngredient } from '@/services/globalIngredientService';

/**
 * THE round-trip regression (MENU-ITEM-EDITOR-REDESIGN-PLAN §6, §7).
 *
 * `UpdateProductCommand` assigns every column it receives, so **any field the form stops showing
 * must still be SENT or the save CLEARS it**. That is the single most dangerous trap in the
 * redesign, because every "hide what is rare" decision in §3 touches it, and nothing else in the
 * suite would notice: the page would look right, the save would succeed, and the item would
 * quietly lose its kitchen printer, its display order or its order-type override.
 *
 * The proof has to be a save that touches NOTHING. So this submits the form directly rather than
 * clicking Save — Save is deliberately gated on `isDirty`, and any edit made just to unlock it
 * would be the one thing the test cannot afford to do.
 *
 * Fields with NO control on the page today are named individually at the end. They are the ones a
 * future slice can silently drop, and the reason this file exists.
 */
const PRODUCT_ID = 'item-1';
const NAME = 'Margherita';
const DESCRIPTION = 'Tomato, mozzarella, basil';
const PRIMARY_CATEGORY_ID = 'cat-pizza';
const VARIATION_ID = 'var-1';
const INGREDIENT_ID = 'ing-1';
const GLOBAL_INGREDIENT_ID = 'glob-1';
const SIDE_ITEM_ID = 'side-1';
const ITEM_TYPE = 'mainItem';

const fullyPopulated: ProductDetails = {
  id: PRODUCT_ID,
  name: NAME,
  description: DESCRIPTION,
  basePrice: 18.5,
  isActive: true,
  isAvailable: false,
  isSpecial: true,
  hideBaseProduct: true,
  preparationTimeMinutes: 14,
  displayOrder: 7,
  type: ITEM_TYPE,
  kitchenType: 'BackKitchen',
  ingredients: [],
  allergens: ['gluten', 'milk'],
  categories: [
    { categoryId: 'cat-lunch', categoryName: 'Lunch', isPrimary: false },
    { categoryId: PRIMARY_CATEGORY_ID, categoryName: 'Pizzas', isPrimary: true },
  ],
  primaryCategory: { id: PRIMARY_CATEGORY_ID, name: 'Pizzas' },
  variations: [
    {
      id: VARIATION_ID,
      name: 'Large',
      description: '32cm',
      priceModifier: 4,
      isActive: true,
      displayOrder: 2,
      content: { fr: { name: 'Grande', description: 'trente-deux cm' } },
    },
  ],
  detailedIngredients: [
    {
      id: INGREDIENT_ID,
      name: 'Mozzarella',
      isOptional: true,
      price: 2.5,
      isActive: true,
      displayOrder: 1,
      content: { fr: { name: 'Mozzarella de bufflonne' } },
      // Present so the save does not go looking the ingredient up in the global library — that
      // path is the shared-modifiers plan's, not this one's.
      globalIngredientId: GLOBAL_INGREDIENT_ID,
    },
  ],
  images: [{ id: 'img-1', url: '/uploads/margherita.jpg', altText: NAME, isPrimary: true, sortOrder: 0 }],
  suggestedSideItems: [{ id: SIDE_ITEM_ID, name: 'Garlic bread', description: '', price: 4 }],
  availableOrderTypes: 3,
  content: { en: { name: NAME, description: DESCRIPTION } },
} as unknown as ProductDetails;

const renderAndSaveUntouched = async (product: ProductDetails) => {
  const { container } = render(
    <ProductEditorPage product={product} isBundle={false} mode="edit" onSaved={jest.fn()} onBack={jest.fn()} />,
  );
  await act(async () => {});

  // `fireEvent` already wraps its dispatch in act(); the flush that matters is the async submit
  // handler, and `waitFor` is what awaits that.
  fireEvent.submit(container.querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));

  return (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
};

beforeEach(() => jest.clearAllMocks());

describe('product editor — a save that changes nothing changes nothing', () => {
  it('sends back every value it loaded', async () => {
    const payload = await renderAndSaveUntouched(fullyPopulated);

    expect(payload).toMatchObject({
      id: PRODUCT_ID,
      name: NAME,
      description: DESCRIPTION,
      basePrice: 18.5,
      isActive: true,
      isAvailable: false,
      isSpecial: true,
      preparationTimeMinutes: 14,
      type: ITEM_TYPE,
      allergens: ['gluten', 'milk'],
      primaryCategoryId: PRIMARY_CATEGORY_ID,
    });
    expect(payload.categoryIds).toEqual(['cat-lunch', PRIMARY_CATEGORY_ID]);
    expect(payload.content).toEqual({ en: { name: NAME, description: DESCRIPTION } });
  });

  it('keeps the variation rows, ids and per-locale names intact', async () => {
    const payload = await renderAndSaveUntouched(fullyPopulated);

    expect(payload.variations).toEqual([
      {
        id: VARIATION_ID,
        name: 'Large',
        description: '32cm',
        priceModifier: 4,
        isActive: true,
        displayOrder: 2,
        content: { fr: { name: 'Grande', description: 'trente-deux cm' } },
      },
    ]);
  });

  /**
   * Ingredient ids are the reference an order line keeps (`OrderItem.IngredientQuantitiesJson`),
   * so an editor that dropped or re-minted one would blank the detail on every past order. The
   * server-side half of that is the shared-modifiers plan's S0; this half is that the editor must
   * send the id it was given, unchanged, on a save it was not asked to make.
   */
  it('sends the ingredient back with the id it was loaded with', async () => {
    const payload = await renderAndSaveUntouched(fullyPopulated);

    expect(payload.detailedIngredients).toMatchObject([
      { id: INGREDIENT_ID, name: 'Mozzarella', isOptional: true, price: 2.5, globalIngredientId: GLOBAL_INGREDIENT_ID },
    ]);
    expect(createGlobalIngredient).not.toHaveBeenCalled();
  });

  /**
   * The list this file is really about: values the PUT assigns unconditionally and the page shows
   * either nowhere at all (`displayOrder`) or only through a control a later slice may move.
   * Deleting an assertion here is only correct together with a backend change.
   */
  it('preserves the fields the form does not (or barely) show', async () => {
    const payload = await renderAndSaveUntouched(fullyPopulated);

    // No control anywhere on the page — carried purely by the form defaults.
    expect(payload.displayOrder).toBe(7);
    // A three-button group inside Details; invisible from the section nav.
    expect(payload.kitchenType).toBe('BackKitchen');
    // Meaningful only with variations, and D7 makes it conditional in S8.
    expect(payload.hideBaseProduct).toBe(true);
    // null means "inherit"; 3 is an explicit override that must never collapse back to null.
    expect(payload.availableOrderTypes).toBe(3);
    // Set through a picker in its own section — the payload key is not the section's name.
    expect(payload.suggestedSideItemIds).toEqual([SIDE_ITEM_ID]);
  });

  it('never invents a menu definition for a plain item', async () => {
    const payload = await renderAndSaveUntouched(fullyPopulated);

    // A defined menuDefinition would route the item's save to the BUNDLE endpoint.
    expect(payload.menuDefinition).toBeUndefined();
  });
});
