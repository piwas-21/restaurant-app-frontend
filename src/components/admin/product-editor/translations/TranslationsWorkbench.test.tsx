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
    // A SAUCE, because #588 made `detailedIngredients` hold two kinds behind one array. Without a
    // second kind in the fixture nothing here exercises the grouping or proves `kind` round-trips.
    { id: 'ing-2', name: 'Garlic mayo', kind: 'sauce', isOptional: true, price: 1, isActive: true, displayOrder: 1 },
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

/**
 * A row's target input. `source` is part of the name because the label is `"<source> · <field>"` —
 * two ingredients would otherwise be two identically named fields (see `TranslationSlotRows`).
 */
const targetField = (view: ReturnType<typeof within>, field: string, language: string, source?: string) =>
  view.getByLabelText(
    `editor_translations_target_field[field=${source ? `${source} · ${field}` : field},language=${language}]`,
  ) as HTMLInputElement;

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

    fireEvent.change(targetField(view, 'item_name', 'Nederlands', 'Margherita Pizza'), {
      target: { value: 'Margherita pizza' },
    });
    fireEvent.change(targetField(view, 'variation_name', 'Nederlands', 'Large'), { target: { value: 'Groot' } });
    fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', 'Nederlands', 'Mozzarella'), {
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
      fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', nativeName, 'Mozzarella'), {
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
    fireEvent.change(targetField(view, 'item_name', 'Deutsch', 'Margherita Pizza'), {
      target: { value: 'Margherita-Pizza' },
    });

    selectLocale(view, 'Italiano');
    expect(targetField(view, 'item_name', 'Italiano', 'Margherita Pizza').value).toBe('');

    selectLocale(view, 'Deutsch');
    expect(targetField(view, 'item_name', 'Deutsch', 'Margherita Pizza').value).toBe('Margherita-Pizza');
  });

  it('unlocks the one Save, which is gated on the form being dirty', async () => {
    const { container, view } = await openWorkbench();
    const saveButton = container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement;
    expect(saveButton).toBeDisabled();

    selectLocale(view, 'Deutsch');
    fireEvent.change(targetField(view, 'item_name', 'Deutsch', 'Margherita Pizza'), {
      target: { value: 'Margherita-Pizza' },
    });

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
      /editor_translations_progress\[done=1,total=5\]/,
    );
    expect(view.getByRole('button', { name: /^Deutsch/ })).toHaveAccessibleName(
      /editor_translations_progress\[done=0,total=5\]/,
    );
  });

  it('moves the count and the badge as a translation is typed', async () => {
    const { view } = await openWorkbench();
    selectLocale(view, 'Français');

    expect(view.getByText('editor_translations_missing[count=4]')).toBeInTheDocument();

    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Français', 'Classic tomato and mozzarella'),
      {
        target: { value: 'Tomate et mozzarella' },
      },
    );
    expect(view.getByText('editor_translations_missing[count=3]')).toBeInTheDocument();
    // The RAIL at the same intermediate moment, and this is the control rather than a repeat: the
    // badge and the rail read one `progress` object, so "they agree" is satisfied by two counters
    // that are identically wrong — and at the two ENDS (nothing done, everything done) they are
    // saturated and agree trivially. A rail frozen until completion passes every other assertion
    // in this test. Only a mid-flight number can tell a live counter from a static one.
    expect(view.getByRole('button', { name: /^Français/ })).toHaveAccessibleName(
      /editor_translations_progress\[done=2,total=5\]/,
    );

    fireEvent.change(targetField(view, 'variation_name', 'Français', 'Large'), { target: { value: 'Grande' } });
    fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', 'Français', 'Mozzarella'), {
      target: { value: 'Mozzarelle' },
    });
    // The SAUCE counts toward the same total as the ingredient — one item, one denominator.
    fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', 'Français', 'Garlic mayo'), {
      target: { value: "Mayonnaise à l'ail" },
    });

    // Both saturate together. Meaningful only BECAUSE of the mid-flight check above.
    expect(view.getAllByText('editor_translations_all_translated')).toHaveLength(2);
    expect(view.getByRole('button', { name: /^Français/ })).toHaveAccessibleName(/editor_translations_all_translated/);
  });

  it('fills every empty field from the source column on request, and says how many', async () => {
    const { container, view } = await openWorkbench();
    selectLocale(view, 'Deutsch');

    fireEvent.click(view.getByRole('button', { name: 'editor_translations_copy_source' }));

    expect(targetField(view, 'item_name', 'Deutsch', 'Margherita Pizza').value).toBe('Margherita Pizza');
    expect(view.getByText('editor_translations_copied[count=5]')).toBeInTheDocument();

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

    expect(targetField(view, 'item_name', 'العربية', 'Margherita Pizza')).toHaveAttribute('dir', 'rtl');
    // The source column shows the item's own text, which declares no language at all.
    expect(view.getByLabelText('editor_translations_source_field[field=Margherita Pizza · item_name]')).toHaveAttribute(
      'dir',
      'auto',
    );
  });

  it('follows the chosen source language when it is one of the ten', async () => {
    const { view } = await openWorkbench();

    fireEvent.change(view.getByLabelText('editor_translations_source_language'), { target: { value: 'ar' } });

    // No `<source> ·` prefix here, and that is the rule working: the item has no Arabic text, so the
    // source cell is EMPTY and there is nothing to name the row by. The label falls back to the
    // field's own name rather than inventing one.
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

    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Deutsch', 'Classic tomato and mozzarella'),
      {
        target: { value: 'Tomate und Mozzarella' },
      },
    );
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    const message = await view.findByRole('alert');
    expect(message).toHaveTextContent('Name is required for this language');
    expect(targetField(view, 'item_name', 'Deutsch', 'Margherita Pizza')).toHaveAttribute('aria-invalid', 'true');
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

describe('the jump follows the language, not just the tab', () => {
  /**
   * S7/D13's save-bar jump focuses `[name="content.N.name"]`, and this panel renders one row per
   * string for the SELECTED language only. So a French refusal while the rail sits on German gave a
   * tab switch, a correct field name, and nothing on screen to focus — the admin arrived at the
   * right tab and saw no error at all.
   *
   * The rail moves only when the CURRENT language is clean, which is why the test walks away from
   * French first: it must not pull an admin off a language they are still fixing.
   */
  it('sends the rail back to the language that is refusing', async () => {
    const { container, view } = await openWorkbench();
    selectLocale(view, 'Français');

    // The one refusal this panel can produce: a locale given a description and no name.
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Français', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate et mozzarella' } },
    );
    fireEvent.change(targetField(view, 'item_name', 'Français', 'Margherita Pizza'), { target: { value: '' } });

    selectLocale(view, 'Deutsch');
    expect(targetField(view, 'item_name', 'Deutsch', 'Margherita Pizza').value).toBe('');

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    const message = await view.findByRole('alert');
    expect(message).toHaveTextContent('Name is required for this language');
    expect(targetField(view, 'item_name', 'Français', 'Margherita Pizza')).toHaveAttribute('aria-invalid', 'true');
    expect(updateProduct).not.toHaveBeenCalled();
  });
});

describe('leaving a cell validates it, although nothing here is registered', () => {
  /**
   * The panel writes through `setValue`, so react-hook-form's `onTouched` mode — which only ever
   * validates fields it REGISTERED — never fires for a single cell in this grid. Without the
   * explicit trigger the resolver's refusal appeared for the first time on Save, which is the
   * defect S7 exists to end.
   *
   * A blank variation name that still carries a French translation: the slot exists because a
   * locale holds text for it, and `variationSchema.name` is `min(1)`, so leaving the cell is enough
   * to refuse.
   */
  const blankVariationName = {
    ...margherita,
    variations: [
      {
        id: 'var-1',
        name: '',
        description: '',
        priceModifier: 4,
        isActive: true,
        displayOrder: 0,
        content: { fr: { name: 'Grande' } },
      },
    ],
  } as unknown as ProductDetails;

  it('triggers the variation the admin just left, and leaves the ingredient alone', async () => {
    const { container, view } = await openWorkbench(blankVariationName);
    selectLocale(view, 'Français');

    // An ingredient is plain `useState`: it has no resolver rule, so leaving one must not
    // manufacture a refusal out of a store the resolver does not read.
    fireEvent.blur(targetField(view, 'editor_translations_field_ingredient_name', 'Français', 'Mozzarella'));
    expect(container.querySelector('[data-testid="editor-error-summary"]')).toBeNull();

    fireEvent.blur(targetField(view, 'variation_name', 'Français'));

    await waitFor(() =>
      expect(container.querySelector('[data-testid="editor-error-summary"]')).toHaveTextContent(
        'editor_error_summary[count=1]',
      ),
    );
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

describe('the two ingredient kinds #588 introduced (S5) survive this tab', () => {
  /**
   * `detailedIngredients` is ONE array holding ingredients AND sauces. The workbench must group
   * them the way the Item tab names them, or it files a sauce in a section it is not in.
   */
  it('files the sauce under Sauces and the ingredient under Ingredients', async () => {
    const { view } = await openWorkbench();

    expect(view.getByRole('region', { name: 'ingredients' })).toContainElement(view.getByDisplayValue('Mozzarella'));
    expect(view.getByRole('region', { name: 'sauces' })).toContainElement(view.getByDisplayValue('Garlic mayo'));
  });

  /**
   * §6's trap in its newest form. `kind` has NO control anywhere in this tab, and the tab rewrites
   * the whole ingredient array to store a translation — so if the writer rebuilt a row instead of
   * spreading it, every sauce on the product would silently become an ingredient on the next save.
   * That is a data loss no type checks and no conflict would have shown.
   */
  it('sends `kind` back untouched after translating the sauce it belongs to', async () => {
    const { container, view } = await openWorkbench();

    selectLocale(view, 'Français');
    fireEvent.change(targetField(view, 'editor_translations_field_ingredient_name', 'Français', 'Garlic mayo'), {
      target: { value: "Mayonnaise à l'ail" },
    });

    const payload = await save(container);
    const sent = payload.detailedIngredients as Array<Record<string, unknown>>;

    expect(sent.map((row) => row.kind)).toEqual([undefined, 'sauce']);
    expect(sent[1].content).toMatchObject({ fr: { name: "Mayonnaise à l'ail" } });
    // And the row the admin did NOT touch keeps its own identity.
    expect(sent[0].name).toBe('Mozzarella');
  });
});
