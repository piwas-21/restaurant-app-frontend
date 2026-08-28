import React from 'react';
import { act, render, fireEvent, waitFor, within } from '@testing-library/react';
import ProductEditorPage from '../ProductEditorPage';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

/**
 * `t` INTERPOLATES here, unlike the `(key) => key` stub the rest of the editor suite uses.
 *
 * It has to: this panel names ten locales' worth of inputs with one key and a `{{language}}`, so a
 * key-only stub would give every row in the grid the same accessible name and the test could not
 * tell an Arabic field from a Dutch one — which is the exact confusion the screen exists to end.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: unknown) =>
      vars && typeof vars === 'object'
        ? `${key}[${Object.entries(vars as Record<string, unknown>)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(',')}]`
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
jest.mock('@/services/menuService', () => ({ createProduct: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ createMenuBundle: jest.fn(), updateMenuBundle: jest.fn() }));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(async () => ({ success: true, data: { id: 'glob-new' } })),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
  getGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-pizza', name: 'Pizzas' }] } })),
}));

import { updateProduct } from '@/services/productService';

const margherita = {
  id: 'item-1',
  name: 'Margherita Pizza',
  description: 'Classic tomato and mozzarella',
  basePrice: 18,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  preparationTimeMinutes: 10,
  type: 'mainItem',
  ingredients: [],
  allergens: [],
  categories: [{ categoryId: 'cat-pizza', categoryName: 'Pizzas', isPrimary: true }],
  primaryCategory: { id: 'cat-pizza', name: 'Pizzas' },
  variations: [{ id: 'var-1', name: 'Large', description: '', priceModifier: 4, isActive: true, displayOrder: 0 }],
  detailedIngredients: [
    { id: 'ing-1', name: 'Mozzarella', isOptional: false, price: 0, isActive: true, displayOrder: 0 },
  ],
  images: [],
  suggestedSideItems: [],
  availableOrderTypes: null,
  content: { fr: { name: 'Pizza Margherita', description: '' } },
} as unknown as ProductDetails;

const openWorkbench = async (product: ProductDetails = margherita) => {
  const { container } = render(
    <ProductEditorPage product={product} isBundle={false} mode="edit" onSaved={jest.fn()} onBack={jest.fn()} />,
  );
  await act(async () => {});

  fireEvent.click(container.querySelector('[role="tab"][aria-controls$="panel-translations"]') as HTMLElement);
  const panel = container.querySelector('#product-editor-form-panel-translations') as HTMLElement;
  return { container, panel, view: within(panel) };
};

/** The rail entry for a locale — its accessible name starts with the language's own name. */
const selectLocale = (view: ReturnType<typeof within>, nativeName: string) =>
  fireEvent.click(view.getByRole('button', { name: new RegExp(`^${nativeName}`) }));

const targetField = (view: ReturnType<typeof within>, field: string, language: string) =>
  view.getByLabelText(`editor_translations_target_field[field=${field},language=${language}]`) as HTMLInputElement;

const save = async (container: HTMLElement) => {
  fireEvent.submit(container.querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
  return (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
};

beforeEach(() => jest.clearAllMocks());

describe('one surface for every translatable string (D2 / S4)', () => {
  /**
   * The whole point of the slice. Before it, these three strings lived in three different UIs —
   * a row list, a `<details>` on the variation and a second `<details>` on the ingredient — none
   * of which could be reached from the same place, or agreed on which locales existed.
   */
  it('edits the item, a variation and an ingredient from the one locale switcher, and sends all three', async () => {
    const { container, view } = await openWorkbench();
    selectLocale(view, 'Nederlands');

    fireEvent.change(targetField(view, 'item_name', 'Nederlands'), { target: { value: 'Margherita pizza' } });
    fireEvent.change(targetField(view, 'variation_name', 'Nederlands'), { target: { value: 'Groot' } });
    fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', 'Nederlands'), {
      target: { value: 'Mozzarella kaas' },
    });

    const payload = await save(container);

    expect((payload.content as Record<string, { name: string }>).nl.name).toBe('Margherita pizza');
    expect((payload.variations as { content: Record<string, { name: string }> }[])[0].content.nl.name).toBe('Groot');
    expect((payload.detailedIngredients as { content: Record<string, { name: string }> }[])[0].content.nl.name).toBe(
      'Mozzarella kaas',
    );
  });

  /**
   * `nl`, `ru` and `zh` are exactly the three locales the old ingredient seed omitted. Reaching
   * them through the workbench and out into the payload is the behavioural half of that fix; the
   * shape half is pinned in `ProductIngredientsManager.test.tsx`.
   */
  it('reaches the three locales the old ingredient seed left out', async () => {
    const { container, view } = await openWorkbench();

    for (const [nativeName, locale, value] of [
      ['Nederlands', 'nl', 'Basilicum'],
      ['Русский', 'ru', 'Базилик'],
      ['中文', 'zh', '罗勒'],
    ] as const) {
      selectLocale(view, nativeName);
      fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', nativeName), {
        target: { value },
      });
      expect(locale).toBeTruthy();
    }

    const payload = await save(container);
    const ingredient = (payload.detailedIngredients as { content: Record<string, { name: string }> }[])[0];

    expect(ingredient.content).toEqual({
      nl: { name: 'Basilicum' },
      ru: { name: 'Базилик' },
      zh: { name: '罗勒' },
    });
  });

  it('keeps an unsaved edit when the target language changes and comes back', async () => {
    const { view } = await openWorkbench();

    selectLocale(view, 'Deutsch');
    fireEvent.change(targetField(view, 'item_name', 'Deutsch'), { target: { value: 'Margherita-Pizza' } });

    selectLocale(view, 'Italiano');
    expect(targetField(view, 'item_name', 'Italiano').value).toBe('');

    selectLocale(view, 'Deutsch');
    expect(targetField(view, 'item_name', 'Deutsch').value).toBe('Margherita-Pizza');
  });

  it('unlocks the one Save, which is gated on the form being dirty', async () => {
    const { container, view } = await openWorkbench();
    const saveButton = container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement;
    expect(saveButton).toBeDisabled();

    selectLocale(view, 'Deutsch');
    fireEvent.change(targetField(view, 'item_name', 'Deutsch'), { target: { value: 'Margherita-Pizza' } });

    expect(saveButton).not.toBeDisabled();
  });
});

describe('completeness reflects the strings that are really missing', () => {
  /**
   * FOUR slots on this item: its name, its description, the variation's name and the ingredient's
   * name. The variation carries no description, so it contributes no row — a denominator that
   * counted ten fixed fields per object would put "done" permanently out of reach, which is what
   * made the old `<details>` grids useless as a progress signal.
   */
  it('counts each locale against the slots that exist, not against ten fixed fields', async () => {
    const { view } = await openWorkbench();

    expect(view.getByRole('button', { name: /^Français/ })).toHaveAccessibleName(
      /editor_translations_progress\[done=1,total=4\]/,
    );
    expect(view.getByRole('button', { name: /^Deutsch/ })).toHaveAccessibleName(
      /editor_translations_progress\[done=0,total=4\]/,
    );
  });

  it('moves the count and the badge as a translation is typed', async () => {
    const { view } = await openWorkbench();
    selectLocale(view, 'Français');

    expect(view.getByText('editor_translations_missing[count=3]')).toBeInTheDocument();

    fireEvent.change(targetField(view, 'editor_translations_field_item_description', 'Français'), {
      target: { value: 'Tomate et mozzarella' },
    });
    expect(view.getByText('editor_translations_missing[count=2]')).toBeInTheDocument();

    fireEvent.change(targetField(view, 'variation_name', 'Français'), { target: { value: 'Grande' } });
    fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', 'Français'), {
      target: { value: 'Mozzarelle' },
    });

    // The badge AND the rail entry, which is the point: the two counters cannot disagree.
    expect(view.getAllByText('editor_translations_all_translated')).toHaveLength(2);
    expect(view.getByRole('button', { name: /^Français/ })).toHaveAccessibleName(/editor_translations_all_translated/);
  });

  it('fills every empty field from the source column on request, and says how many', async () => {
    const { container, view } = await openWorkbench();
    selectLocale(view, 'Deutsch');

    fireEvent.click(view.getByRole('button', { name: 'editor_translations_copy_source' }));

    expect(targetField(view, 'item_name', 'Deutsch').value).toBe('Margherita Pizza');
    expect(view.getByText('editor_translations_copied[count=4]')).toBeInTheDocument();

    const payload = await save(container);
    expect((payload.content as Record<string, { name: string }>).de.name).toBe('Margherita Pizza');
    // The locale that was already written is not overwritten by the copy.
    expect((payload.content as Record<string, { name: string }>).fr.name).toBe('Pizza Margherita');
  });
});

describe('the three old translation UIs are gone, not restyled', () => {
  it('has no per-row disclosure and no multilingual row list anywhere in the editor', async () => {
    const { container } = await openWorkbench();

    expect(container.querySelectorAll('details')).toHaveLength(0);
    expect(container.textContent).not.toContain('multilingual_content');
    expect(container.textContent).not.toContain('multilingual_names');
    expect(container.textContent).not.toContain('add_language_translation');
  });

  /**
   * Handed forward by S7, which measured that the row list's `content.N.language` select had NO
   * accessible name and was invisible to axe only because the Item tab is what gets scanned. The
   * select is retired with the list; the one control that replaced it ships with a real `<label>`.
   */
  it('names its language select, which the control it replaces never did', async () => {
    const { panel, view } = await openWorkbench();

    const select = view.getByLabelText('editor_translations_source_language');
    expect(select.tagName).toBe('SELECT');
    expect(panel.querySelectorAll('select')).toHaveLength(1);
  });
});

describe('ten locales, one of which reads right to left', () => {
  it('types Arabic right-to-left inside a left-to-right admin page', async () => {
    const { view } = await openWorkbench();
    selectLocale(view, 'العربية');

    expect(targetField(view, 'item_name', 'العربية')).toHaveAttribute('dir', 'rtl');
    // The source column shows the item's own text, which declares no language at all.
    expect(view.getByLabelText('editor_translations_source_field[field=item_name]')).toHaveAttribute('dir', 'auto');
  });

  it('follows the chosen source language when it is one of the ten', async () => {
    const { view } = await openWorkbench();

    fireEvent.change(view.getByLabelText('editor_translations_source_language'), { target: { value: 'ar' } });

    expect(view.getByLabelText('editor_translations_source_field[field=item_name]')).toHaveAttribute('dir', 'rtl');
  });
});

describe('the refusal this panel can produce, said where it happened', () => {
  /**
   * `contentSchema.name` is `min(1)`, so a locale given a description and no name blocks the whole
   * save. The old row list rendered that message on a screen the admin had no reason to open —
   * they cleared a field and Save simply stopped working. It now renders on the field it is about.
   */
  it('shows the resolver message under the name it belongs to, and posts nothing', async () => {
    const { container, view } = await openWorkbench();
    selectLocale(view, 'Deutsch');

    fireEvent.change(targetField(view, 'editor_translations_field_item_description', 'Deutsch'), {
      target: { value: 'Tomate und Mozzarella' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    const message = await view.findByRole('alert');
    expect(message).toHaveTextContent('Name is required for this language');
    expect(targetField(view, 'item_name', 'Deutsch')).toHaveAttribute('aria-invalid', 'true');
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('says so when the copy has nothing left to fill', async () => {
    const { view } = await openWorkbench();
    selectLocale(view, 'Deutsch');

    const copy = view.getByRole('button', { name: 'editor_translations_copy_source' });
    fireEvent.click(copy);
    fireEvent.click(copy);

    expect(view.getByText('editor_translations_nothing_to_copy')).toBeInTheDocument();
  });
});

describe('an item with nothing to translate', () => {
  /**
   * D11's rule, applied here: a surface with nothing to show says WHY. An empty grid with ten
   * language counters all reading `0/0` would be a screen the admin cannot act on.
   */
  it('renders a reason instead of an empty grid', async () => {
    const blank = {
      ...margherita,
      name: '',
      description: '',
      variations: [],
      detailedIngredients: [],
      content: {},
    } as unknown as ProductDetails;

    const { view } = await openWorkbench(blank);

    expect(view.getByText('editor_translations_empty[tab=item]')).toBeInTheDocument();
    expect(view.queryByLabelText(/editor_translations_target_field/)).toBeNull();
  });
});
