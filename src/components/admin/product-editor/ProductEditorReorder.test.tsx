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
    data: { items: [{ id: 'cat-pizza', name: 'Pizzas' }] },
  })),
}));

import { updateProduct } from '@/services/productService';

/**
 * Reordering the editor's two row tables — frontend **#593**, editor plan slice **S8**.
 *
 * The bar this file sets is deliberately the PAYLOAD, not the DOM. `displayOrder` is what every
 * consumer sorts by, and it is a field with **no input anywhere on the page**: a reorder that moved
 * the rows on screen while each row kept the number it arrived with would look completely correct
 * and would be undone by the next load. So each test clicks the real control and then asserts what
 * `updateProduct` was handed.
 *
 * The fixture's `displayOrder` values are deliberately BROKEN — a duplicate and a gap. Nothing in
 * the editor ever wrote this column after a row was created, so live data can hold exactly that,
 * and a move must leave the column contiguous rather than preserve the damage.
 */
const PRODUCT_ID = 'item-1';

const reorderable: ProductDetails = {
  id: PRODUCT_ID,
  name: 'Margherita',
  description: '',
  basePrice: 18.5,
  isActive: true,
  isAvailable: true,
  preparationTimeMinutes: 10,
  displayOrder: 7,
  type: 'mainItem',
  kitchenType: 'BackKitchen',
  ingredients: [],
  allergens: [],
  categories: [{ categoryId: 'cat-pizza', categoryName: 'Pizzas', isPrimary: true }],
  primaryCategory: { id: 'cat-pizza', name: 'Pizzas' },
  variations: [
    { id: 'var-large', name: 'Large', description: '', priceModifier: 4, isActive: true, displayOrder: 2, content: {} },
    {
      id: 'var-small',
      name: 'Small',
      description: '',
      priceModifier: -2,
      isActive: true,
      displayOrder: 5,
      content: {},
    },
  ],
  // Interleaved on purpose: the two kinds are two views over ONE array, so a naive index swap on
  // the whole array would drag the sauce along with the ingredient's move.
  detailedIngredients: [
    { id: 'ing-a', name: 'Mozzarella', isOptional: true, price: 0, isActive: true, displayOrder: 5, content: {} },
    { id: 'sauce-1', name: 'Chilli oil', kind: 'sauce', isOptional: true, price: 1, isActive: true, displayOrder: 5 },
    { id: 'ing-b', name: 'Basil', isOptional: true, price: 0, isActive: true, displayOrder: 9, content: {} },
  ],
  images: [],
  suggestedSideItems: [],
  content: {},
} as unknown as ProductDetails;

type Row = { id: string; displayOrder: number };

const renderEditor = async () => {
  const view = render(
    <ProductEditorPage product={reorderable} isBundle={false} mode="edit" onSaved={jest.fn()} onBack={jest.fn()} />,
  );
  await act(async () => {});
  return view.container;
};

const submitAndReadPayload = async (container: HTMLElement) => {
  fireEvent.submit(container.querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
  return (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
};

/**
 * The row is found through a field it OWNS rather than by position in the document, because the
 * mocked `t` returns the key, so every table on the page shows the same `move_row_down` label.
 */
const moveButtonIn = (row: Element, direction: 'up' | 'down') =>
  row.querySelector(`button[aria-label="move_row_${direction}"]`) as HTMLButtonElement;

const variationRow = (container: HTMLElement, index: number) =>
  (container.querySelector(`input[name="variations.${index}.name"]`) as HTMLElement).closest('tr') as HTMLElement;

const ingredientRows = (container: HTMLElement) =>
  Array.from(
    (container.querySelector('section[aria-labelledby="recipe-group-ingredient"]') as HTMLElement).querySelectorAll(
      'tbody tr',
    ),
  );

beforeEach(() => jest.clearAllMocks());

describe('variation reordering (#593)', () => {
  it('sends the new order AND renumbers displayOrder, which no input on the page shows', async () => {
    const container = await renderEditor();

    fireEvent.click(moveButtonIn(variationRow(container, 0), 'down'));
    const payload = await submitAndReadPayload(container);

    // `useFieldArray.move` alone would produce ['var-small', 'var-large'] carrying [5, 2] — the
    // screen right, the payload wrong, and the next load putting Large back on top.
    expect((payload.variations as Row[]).map((row) => row.id)).toEqual(['var-small', 'var-large']);
    expect((payload.variations as Row[]).map((row) => row.displayOrder)).toEqual([0, 1]);
  });

  it('disables the control at the ends of the list instead of hiding it', async () => {
    const container = await renderEditor();

    // Dimmed, not gone: a control that vanishes makes the row jump and leaves the admin unsure
    // whether reordering exists at all.
    expect(moveButtonIn(variationRow(container, 0), 'up')).toBeDisabled();
    expect(moveButtonIn(variationRow(container, 0), 'down')).toBeEnabled();
    expect(moveButtonIn(variationRow(container, 1), 'down')).toBeDisabled();
  });
});

describe('recipe-row reordering (#593)', () => {
  it('moves the ingredient, leaves the sauce exactly where it was, and repairs the column', async () => {
    const container = await renderEditor();

    fireEvent.click(moveButtonIn(ingredientRows(container)[0], 'down'));
    const payload = await submitAndReadPayload(container);
    const rows = payload.detailedIngredients as Row[];

    // The sauce keeps its array position between the two ingredients; only the ingredients swapped.
    expect(rows.map((row) => row.id)).toEqual(['ing-b', 'sauce-1', 'ing-a']);
    // The fixture arrived with a duplicate 5 and a gap at 9. Contiguous is the invariant, and it is
    // asserted over BOTH kinds because they share one numbering space.
    expect(rows.map((row) => row.displayOrder)).toEqual([0, 1, 2]);
  });

  it('gives the lone sauce no move it can make', async () => {
    const container = await renderEditor();
    const sauceRow = (
      container.querySelector('section[aria-labelledby="recipe-group-sauce"]') as HTMLElement
    ).querySelector('tbody tr') as HTMLElement;

    expect(moveButtonIn(sauceRow, 'up')).toBeDisabled();
    expect(moveButtonIn(sauceRow, 'down')).toBeDisabled();
  });
});
