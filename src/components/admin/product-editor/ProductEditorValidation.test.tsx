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

// Conformance gap G10, taken inline because S7 already owns this file. The affix is described-by
// rather than hidden, so the currency reaches the accessibility tree as well as the eye.
describe('editor base price — the currency is heard, not only seen (G10)', () => {
  it('describes the price input with the tenant currency, alongside any error', async () => {
    const { nameInput, container } = await renderEditor();
    const price = container.querySelector('input[name="basePrice"]') as HTMLInputElement;

    const described = (price.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    expect(described).toHaveLength(1);
    expect(document.getElementById(described[0])).toHaveTextContent('CHF');

    // And when the field ALSO has an error, the two ids coexist — a plain `aria-describedby`
    // after the spread would have dropped whichever came first.
    fireEvent.change(price, { target: { value: '-1' } });
    fireEvent.blur(price);
    await waitFor(() => expect(price).toHaveAttribute('aria-invalid', 'true'));

    const both = (price.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    expect(both).toHaveLength(2);
    expect(document.getElementById(both[0])).toHaveTextContent(/Number must be greater than|greater than/);
    expect(document.getElementById(both[1])).toHaveTextContent('CHF');
    expect(nameInput).toBeInTheDocument();
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

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    // `waitFor`, not an `act()` wrapper (Sonar S8980 — `fireEvent` already flushes): the resolver
    // is async, so the refusal and the focus move land a microtask after the submit.
    await waitFor(() => expect(document.activeElement).toBe(nameInput));
    expect(updateProduct).not.toHaveBeenCalled();
  });

  /**
   * A translation row is in the OTHER tab, which is `hidden` — and a hidden panel cannot take
   * focus. The jump therefore has to switch tab first, which is the one case `focusField` cannot
   * handle on its own (it refuses to write to a React-controlled `hidden`, §12.3).
   *
   * S4 replaced the per-language row list this used to drive with the Translations workbench, so
   * the field is now reached through the locale rail. The BEHAVIOUR under test is unchanged and is
   * the reason the test was ported rather than deleted: a translation error must still name itself
   * on the save bar and still be reachable in one click.
   */
  it('switches to the Translations tab before jumping to a translation error', async () => {
    const { container } = await renderEditor();

    // Open the tab and pick the language: the rail starts on the first one that still needs work,
    // and this product's only translation is English. Both are inside the panel, which is `hidden`
    // while the Item tab is selected — so they are not reachable until the tab is open, which is
    // itself the thing this test is about.
    fireEvent.click(screen.getByRole('tab', { name: 'editor_tab_translations' }));
    fireEvent.click(screen.getByRole('button', { name: /^English/ }));

    // The workbench names its cells with the form path, which is what `focusField` resolves.
    const translationName = container.querySelector('input[name="content.0.name"]') as HTMLInputElement;
    expect(translationName).not.toBeNull();
    fireEvent.change(translationName, { target: { value: '' } });
    fireEvent.blur(translationName);

    // Go back to the Item tab, so the jump has a tab to switch AWAY from. This is also what proves
    // the panel stays mounted: the error has to survive being hidden.
    fireEvent.click(screen.getByRole('tab', { name: 'item' }));

    const chip = await screen.findByTestId('editor-error-summary');
    expect(chip).toHaveTextContent('editor_error_summary:1');

    fireEvent.click(chip);

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'editor_tab_translations' })).toHaveAttribute('aria-selected', 'true'),
    );
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

/**
 * A product **exactly as the API sends it**, nulls and all.
 *
 * `ProductVariationDto.Description`, `ProductVariationContentDto.Description` and
 * `ProductDescriptionDto.Description` are all `string?` in C#, and System.Text.Json writes an
 * absent one as an explicit `null` — verified against the projection in
 * `GetProductByIdQuery.cs:173`. `toItemDefaults` seeds the form from that response verbatim, so
 * these nulls are what the resolver really validated in production.
 */
const asTheApiSendsIt = {
  ...item,
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
  content: { en: { name: 'Margherita', description: null } },
} as unknown as ProductDetails;

/** The same harness as above, on the product shape the API really returns. */
const renderApiItem = async () => {
  const view = render(
    <ProductEditorPage product={asTheApiSendsIt} isBundle={false} onSaved={jest.fn()} onBack={jest.fn()} />,
  );
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
    await renderApiItem();
    fireEvent.change(screen.getByLabelText('product_name'), { target: { value: 'Margherita Bianca' } });

    await save();

    expect(updateProduct).toHaveBeenCalledTimes(1);
  });

  // The owner's first symptom, end to end: the delete was correct all along — the SAVE never ran.
  it('really deletes a variation, instead of a refused save putting it back', async () => {
    await renderApiItem();

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
    await renderApiItem();
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
    await renderApiItem();
    fireEvent.change(screen.getByLabelText('product_name'), { target: { value: 'Margherita Bianca' } });

    await save();

    expect(updateProduct).toHaveBeenCalledTimes(1);
    const [, payload] = (updateProduct as jest.Mock).mock.calls[0];
    // Sent, and sent as the "no rule" values — a PUT that omitted them would clear a stored rule.
    expect(payload).toMatchObject({ sauceMin: 0, sauceMax: null, sauceIncludedFree: 0 });
  });
});
