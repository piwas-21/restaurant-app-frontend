import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductEditorPage from './ProductEditorPage';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // The second argument is a default STRING in some call sites and an interpolation OBJECT in
    // others, so the count is only appended when it really is an object carrying one.
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

const renderEditor = async () => {
  const view = render(<ProductEditorPage product={item} isBundle={false} onSaved={jest.fn()} onBack={jest.fn()} />);
  await act(async () => {});
  const nameInput = view.container.querySelector('input[name="name"]') as HTMLInputElement;
  return { ...view, nameInput };
};

/** Empty the required name and leave the field, which is what `onTouched` reacts to. */
const emptyTheName = async (input: HTMLInputElement) => {
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.blur(input);
  await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
};

/**
 * Validation UX — MENU-ITEM-EDITOR-REDESIGN-PLAN decision **D13**, slice **S7**.
 *
 * The defect: this form validated on SUBMIT only, and a refusal three sections down the page
 * looked exactly like a Save button that did nothing. `ProductVariations` did not render its
 * messages at all, so a blank variation name blocked every save with nothing on screen to explain
 * it. And every message that DID render was a bare `<p>` beside its input — visible to a sighted
 * user, invisible in the accessibility tree.
 */
describe('editor validation — onTouched, and a message the assistive tree can find (D13)', () => {
  it('validates when the admin LEAVES a field, not while typing and not only on submit', async () => {
    const { nameInput } = await renderEditor();

    fireEvent.change(nameInput, { target: { value: '' } });
    // Still silent mid-edit: `onChange` mode would already be shouting here.
    expect(nameInput).not.toHaveAttribute('aria-invalid');

    fireEvent.blur(nameInput);

    expect(await screen.findByText('String must contain at least 1 character(s)')).toBeInTheDocument();
  });

  it('points the input at the sentence that explains it', async () => {
    const { nameInput } = await renderEditor();
    await emptyTheName(nameInput);

    const describedBy = nameInput.getAttribute('aria-describedby') as string;
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy)).toHaveTextContent('String must contain at least 1 character(s)');
    // `role="alert"`, so a message that appears after the caret has moved on is still announced.
    expect(document.getElementById(describedBy)).toHaveAttribute('role', 'alert');
  });

  it('labels every control it marks invalid', async () => {
    const { nameInput } = await renderEditor();

    // The label points at the input by id — before S7 the editor's labels wrapped nothing and
    // named nothing, so clicking one did not focus the field and a screen reader read no name.
    expect(nameInput.id).toBeTruthy();
    expect(document.querySelector(`label[for="${nameInput.id}"]`)).toHaveTextContent('product_name');
  });

  // `aria-invalid="false"` is announced by some screen readers as a state worth mentioning on a
  // field nobody has touched, so the attribute is absent rather than false.
  it('never claims a untouched field is valid out loud', async () => {
    const { nameInput } = await renderEditor();

    expect(nameInput).not.toHaveAttribute('aria-invalid');
  });
});

describe('editor validation — the save bar says how many and where (D13, gap G4)', () => {
  it('shows no chip while the form is clean', async () => {
    await renderEditor();

    expect(screen.queryByTestId('editor-error-summary')).not.toBeInTheDocument();
  });

  it('counts the failing fields and offers the jump', async () => {
    const { nameInput } = await renderEditor();
    await emptyTheName(nameInput);

    expect(await screen.findByTestId('editor-error-summary')).toHaveTextContent('editor_error_summary:1');
  });

  it('marks the section that holds the error in the nav', async () => {
    const { nameInput, container } = await renderEditor();
    await emptyTheName(nameInput);

    const basics = within(container.querySelector('nav') as HTMLElement).getByRole('button', {
      name: /editor_section_basics/,
    });
    // The glyph is aria-hidden; the accessible name is what a screen reader actually gets.
    await waitFor(() => expect(basics).toHaveAccessibleName(/editor_section_has_errors/));
  });

  it('takes the caret to the first failing field when the chip is pressed', async () => {
    const { nameInput } = await renderEditor();
    await emptyTheName(nameInput);
    // Move focus away, so "the chip focused it" is distinguishable from "it never lost focus".
    (document.activeElement as HTMLElement)?.blur();

    fireEvent.click(await screen.findByTestId('editor-error-summary'));

    expect(document.activeElement).toBe(nameInput);
  });

  // The defect that made S7 worth a slice: a refused Save with no visible cause.
  it('jumps to the first error on a refused submit, and posts nothing', async () => {
    const { nameInput, container } = await renderEditor();
    await emptyTheName(nameInput);
    (document.activeElement as HTMLElement)?.blur();

    await act(async () => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    });

    expect(updateProduct).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(nameInput);
  });

  // A translation row is in the OTHER tab, which is `hidden` — and a hidden panel cannot take
  // focus. The jump therefore has to switch tab first, which is the one case `focusField` cannot
  // handle on its own (it refuses to write to a React-controlled `hidden`, §12.3).
  it('switches to the Translations tab before jumping to a translation error', async () => {
    const { container } = await renderEditor();

    const translationName = container.querySelector('input[name="content.0.name"]') as HTMLInputElement;
    fireEvent.change(translationName, { target: { value: '' } });
    fireEvent.blur(translationName);

    const chip = await screen.findByTestId('editor-error-summary');
    expect(chip).toHaveTextContent('editor_error_summary:1');

    await act(async () => {
      fireEvent.click(chip);
    });

    expect(screen.getByRole('tab', { name: 'editor_tab_translations' })).toHaveAttribute('aria-selected', 'true');
  });

  // `variationSchema.name` is `min(1)` and this file rendered no message at all before S7, so the
  // form refused to save with nothing on screen anywhere.
  it('surfaces a blank variation name, which had no message at all', async () => {
    const { container } = await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'add_variation' }));
    const variationName = container.querySelector('input[name="variations.0.name"]') as HTMLInputElement;
    fireEvent.blur(variationName);

    expect(await screen.findByText('Variation name is required')).toBeInTheDocument();
    await waitFor(() => expect(variationName).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByTestId('editor-error-summary')).toHaveTextContent('editor_error_summary:1');
  });
});
