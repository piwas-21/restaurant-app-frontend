import React from 'react';
import { act, render, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
jest.mock('@/services/productParentBundlesService', () => ({
  getProductParentBundles: jest.fn(async () => ({ success: true, data: { items: [] } })),
}));
jest.mock('@/services/menuBundleService', () => ({ createMenuBundle: jest.fn(), updateMenuBundle: jest.fn() }));
jest.mock('@/services/globalIngredientService', () => ({
  createGlobalIngredient: jest.fn(async () => ({ success: true, data: { id: 'glob-new' } })),
  searchGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
  getGlobalIngredients: jest.fn(async () => ({ success: true, data: [] })),
}));
jest.mock('@/services/categoryService', () => ({
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-pizza', name: 'Pizzas' }] } })),
}));
jest.mock('@/services/translationWorkbenchService', () => ({
  translationWorkbenchService: {
    preview: jest.fn(async () => ({ rows: [] })),
    suggest: jest.fn(async () => ({ providerStatus: 'disabled', suggestions: [], skipped: [] })),
    review: jest.fn(async () => ({ decisions: [] })),
  },
}));

import { updateProduct } from '@/services/productService';
import { updateMenuBundle } from '@/services/menuBundleService';
import { translationWorkbenchService } from '@/services/translationWorkbenchService';
import type {
  TranslationFieldStatus,
  TranslationSuggestion,
  TranslationWorkbenchAdapter,
  TranslationWorkbenchRequest,
} from '@/services/translationWorkbenchService';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import { EMPTY_MENU_DEFINITION } from '@/utils/productEditorDefaults';

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
  translationMetadata: { sourceLocales: { name: 'en', description: 'en' } },
} as unknown as ProductDetails;

const openWorkbench = async (product: ProductDetails = margherita, isBundle = false) => {
  const { container } = render(
    <ProductEditorPage product={product} isBundle={isBundle} mode="edit" onSaved={jest.fn()} onBack={jest.fn()} />,
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
  fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);
  const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
  const confirm = within(review).getByRole('button', { name: 'editor_review_save' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await act(async () => {
    fireEvent.click(confirm);
    await Promise.resolve();
  });
  await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
  return (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
};

const confirmSaveReview = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);
  const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
  const confirm = within(review).getByRole('button', { name: 'editor_review_save' });
  await waitFor(() => expect(confirm).toBeEnabled());
  await act(async () => {
    fireEvent.click(confirm);
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  const service = translationWorkbenchService as jest.Mocked<TranslationWorkbenchAdapter>;
  service.preview.mockResolvedValue({ rows: [] });
  service.suggest.mockResolvedValue({ providerStatus: 'disabled', suggestions: [], skipped: [] });
  service.review.mockResolvedValue({ decisions: [] });
});

describe('one surface for every translatable string (D2 / S4)', () => {
  it('offers an explicit missing-translation request without generating on workbench open', async () => {
    const service = translationWorkbenchService as jest.Mocked<TranslationWorkbenchAdapter>;
    service.preview.mockImplementation(async (request) => ({
      rows: request.fields.map((field) => ({
        fieldRef: field.fieldRef,
        sourceLocale: field.sourceLocale,
        sourceText: field.sourceText,
        sourceHash: 'source-v1',
        targets: LANGUAGE_CODES.map((locale) => ({
          locale,
          status: locale === 'de' ? ('missing' as const) : ('current' as const),
        })),
      })),
    }));
    service.suggest.mockResolvedValue({ providerStatus: 'ready', suggestions: [], skipped: [] });
    const { view } = await openWorkbench();
    expect(service.suggest).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'editor_translations_review_missing' }));
    await waitFor(() => expect(service.preview).toHaveBeenCalled());
    expect(service.suggest).not.toHaveBeenCalled();
    fireEvent.click(await view.findByRole('button', { name: 'translation_review_suggest_missing' }));
    await waitFor(() => expect(service.suggest).toHaveBeenCalledTimes(1));
    expect(service.suggest.mock.calls[0][0].generationIntent).toBe('explicitFill');
  });
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
    const { container, panel } = await openWorkbench();

    expect(panel.querySelectorAll('details')).toHaveLength(0);
    expect(container.textContent).not.toContain('multilingual_content');
    expect(container.textContent).not.toContain('multilingual_names');
    expect(container.textContent).not.toContain('add_language_translation');
  });

  it('names the copy source and each field source-locale selector', async () => {
    const { panel, view } = await openWorkbench();

    const copySource = view.getByLabelText('editor_translations_copy_from');
    const fieldSource = view.getByLabelText(
      'editor_translations_source_locale_field[field=Margherita Pizza · item_name]',
    );
    expect(copySource.tagName).toBe('SELECT');
    expect(fieldSource.tagName).toBe('SELECT');
    expect(panel.querySelectorAll('select').length).toBeGreaterThan(2);
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

    fireEvent.change(view.getByLabelText('editor_translations_copy_from'), { target: { value: 'ar' } });

    // No `<source> ·` prefix here, and that is the rule working: the item has no Arabic text, so the
    // source cell is EMPTY and there is nothing to name the row by. The label falls back to the
    // field's own name rather than inventing one.
    expect(view.getByLabelText('editor_translations_source_field[field=item_name]')).toHaveAttribute('dir', 'rtl');
  });
});

describe('batched translation review before ordinary Save', () => {
  it('flags source-copy text for manual review and keeps Save available without calling suggestions', async () => {
    const service = translationWorkbenchService as jest.Mocked<TranslationWorkbenchAdapter>;
    service.preview.mockImplementation(async (request) => ({
      rows: request.fields
        .filter((field) => field.fieldRef.entityType === 'product' && field.fieldRef.fieldKey === 'name')
        .map((field) => ({
          fieldRef: field.fieldRef,
          sourceLocale: field.sourceLocale,
          sourceText: field.sourceText,
          sourceHash: 'source-fr',
          targets: [{ locale: 'fr', status: 'sourceCopy', text: 'Pizza Margherita' }],
        })),
    }));
    const { container, view } = await openWorkbench();
    selectLocale(view, 'Français');
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Français', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate et mozzarella' } },
    );

    fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);
    const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
    const drawer = within(review).getByRole('complementary', { name: 'translation_review_title' });

    expect(await within(drawer).findByText('translation_review_gaps[count=1]')).toBeInTheDocument();
    expect(await within(drawer).findByText('translation_review_manual_review[count=1]')).toBeInTheDocument();
    expect(service.suggest).not.toHaveBeenCalled();
    expect(within(review).getByRole('button', { name: 'editor_review_save' })).toBeEnabled();
  });

  it('requires an explicit locale for legacy source text but still permits a normal save', async () => {
    const legacy = { ...margherita, translationMetadata: undefined } as unknown as ProductDetails;
    const { container, view } = await openWorkbench(legacy);
    selectLocale(view, 'Français');
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Français', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate et mozzarella' } },
    );
    fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);

    const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
    expect(within(review).getByText('translation_review_source_locale_missing[count=5]')).toBeInTheDocument();
    expect(translationWorkbenchService.preview).not.toHaveBeenCalled();
    expect(within(review).getByRole('button', { name: 'editor_review_save' })).toBeEnabled();

    fireEvent.click(within(review).getByRole('button', { name: 'editor_review_save' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    expect((updateProduct as jest.Mock).mock.calls[0][1].translationMetadata).toBeUndefined();
  });

  it('previews an unannotated field only after a source language is explicitly selected', async () => {
    const legacy = { ...margherita, translationMetadata: undefined } as unknown as ProductDetails;
    const { container, view } = await openWorkbench(legacy);
    selectLocale(view, 'Français');
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Français', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate et mozzarella' } },
    );
    fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);
    const review = await screen.findByRole('dialog', { name: 'editor_review_title' });

    fireEvent.change(
      within(review).getByLabelText('translation_review_source_locale_pick[field=Margherita Pizza · item_name]'),
      { target: { value: 'tr' } },
    );
    await waitFor(() => expect(translationWorkbenchService.preview).toHaveBeenCalledTimes(1));
    const request = (translationWorkbenchService.preview as jest.Mock).mock.calls[0][0] as TranslationWorkbenchRequest;
    expect(request.fields).toHaveLength(1);
    expect(request.fields[0]).toMatchObject({ fieldRef: { fieldKey: 'name' }, sourceLocale: 'tr' });
  });

  it('records one reviewed batch, applies accepted text to the normal payload, and preserves other locales', async () => {
    const service = translationWorkbenchService as jest.Mocked<TranslationWorkbenchAdapter>;
    const languages = ['de', 'fr', 'ru'] as const;
    const targetState = (locale: string): TranslationFieldStatus['targets'][number] => ({
      locale: locale as TranslationFieldStatus['sourceLocale'],
      status: locale === 'ru' ? 'missing' : locale === 'de' || locale === 'fr' ? 'stale' : 'current',
      text: locale === 'de' ? 'Margherita' : locale === 'fr' ? 'Pizza Margherita' : undefined,
    });
    const rowFor = (field: TranslationWorkbenchRequest['fields'][number]): TranslationFieldStatus => ({
      fieldRef: field.fieldRef,
      sourceLocale: field.sourceLocale,
      sourceText: field.sourceText,
      sourceHash: field.fieldRef.fieldKey === 'name' ? 'source-name' : 'source-description',
      targets: LANGUAGE_CODES.map((locale) => ({
        ...targetState(locale),
        ...(locale === 'tr' && field.fieldRef.fieldKey === 'name'
          ? { provenance: { kind: 'template' as const, sourceHash: 'source-name' } }
          : {}),
      })),
    });
    const suggestions: TranslationSuggestion[] = languages.map((locale) => ({
      suggestionId: `suggestion-${locale}`,
      fieldRef: { entityType: 'product', entityId: 'item-1', fieldKey: 'name' },
      locale,
      sourceHash: 'source-name',
      text: `suggested-${locale}`,
      provider: 'test-provider',
      model: 'test-model',
      status: 'suggested',
    }));
    service.preview.mockImplementation(async (request) => ({ rows: request.fields.map(rowFor) }));
    service.suggest.mockResolvedValue({ providerStatus: 'ready', suggestions, skipped: [] });
    service.review.mockImplementation(async (decisions) => ({
      decisions: decisions.map((decision) => ({
        suggestionId: decision.suggestionId,
        decision: decision.decision,
        status: decision.decision === 'accept' ? 'accepted' : decision.decision === 'edit' ? 'edited' : 'rejected',
        ...(decision.decision === 'edit' ? { text: decision.text } : {}),
      })),
    }));

    const product = {
      ...margherita,
      content: {
        de: { name: 'Margherita', description: '' },
        fr: { name: 'Pizza Margherita', description: '' },
        zh: { name: '玛格丽特披萨', description: '番茄和马苏里拉奶酪' },
      },
      translationMetadata: {
        expectedContentVersion: 'product-content-v7',
        sourceLocales: { description: 'en' },
        provenance: { name: { tr: { kind: 'template', sourceHash: 'source-name', reviewStatus: 'source' } } },
      },
    } as unknown as ProductDetails;
    const { container, view } = await openWorkbench(product);
    selectLocale(view, 'Deutsch');
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Deutsch', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate und Mozzarella' } },
    );
    fireEvent.change(
      view.getByLabelText('editor_translations_source_locale_field[field=Margherita Pizza · item_name]'),
      { target: { value: 'tr' } },
    );

    fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);
    const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
    await waitFor(() => expect(service.suggest).toHaveBeenCalledTimes(1));
    const requestedFields = service.preview.mock.calls[0][0];
    expect(requestedFields.fields.find((field) => field.fieldRef.fieldKey === 'name')).toMatchObject({
      fieldRef: { entityType: 'product', entityId: 'item-1' },
      sourceLocale: 'tr',
      sourceText: 'Margherita Pizza',
      context: { dishName: 'Margherita Pizza', category: 'Pizzas', exclusions: [] },
      targetTexts: {
        de: 'Margherita',
        fr: 'Pizza Margherita',
        zh: '玛格丽特披萨',
      },
    });
    expect(requestedFields.fields.find((field) => field.fieldRef.fieldKey === 'description')).toMatchObject({
      sourceLocale: 'en',
    });

    const drawer = within(review).getByRole('complementary', { name: 'translation_review_title' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'translation_review_accept_all' }));
    fireEvent.change(within(drawer).getByLabelText('translation_review_suggested_text[language=Français]'), {
      target: { value: 'Pizza Margherita maison' },
    });
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: 'translation_review_reject_field[field=Margherita Pizza · item_name,language=Русский]',
      }),
    );
    expect(updateProduct).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(within(review).getByRole('button', { name: 'editor_review_save' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    const payload = (updateProduct as jest.Mock).mock.calls[0][1] as {
      content: Record<string, { name?: string; description?: string }>;
    };
    expect(payload.content.de.name).toBe('suggested-de');
    expect(payload.content.fr.name).toBe('Pizza Margherita maison');
    expect(payload.content.ru).toBeUndefined();
    expect(payload.content.zh).toEqual({ name: '玛格丽特披萨', description: '番茄和马苏里拉奶酪' });
    expect(payload.content.de.description).toBe('Tomate und Mozzarella');
    expect(service.review).toHaveBeenCalledWith([
      { suggestionId: 'suggestion-de', decision: 'accept' },
      { suggestionId: 'suggestion-fr', decision: 'edit', text: 'Pizza Margherita maison' },
      { suggestionId: 'suggestion-ru', decision: 'reject' },
    ]);
    expect((updateProduct as jest.Mock).mock.calls[0][1]).toMatchObject({
      translationMetadata: {
        expectedContentVersion: 'product-content-v7',
        sourceLocales: { name: 'tr', description: 'en' },
        acceptedSuggestionIds: { 'name.de': 'suggestion-de', 'name.fr': 'suggestion-fr' },
      },
    });
  });
});

describe('admin-requested translation alternatives', () => {
  it('keeps an existing manual translation until an alternative is reviewed and accepted', async () => {
    const service = translationWorkbenchService as jest.Mocked<TranslationWorkbenchAdapter>;
    const product = {
      ...margherita,
      content: {
        de: { name: 'Margherita', description: '' },
        fr: { name: 'Pizza Margherita', description: '' },
        zh: { name: '玛格丽特披萨', description: '番茄和马苏里拉奶酪' },
      },
      translationMetadata: {
        expectedContentVersion: 'product-content-v9',
        sourceLocales: { name: 'en', description: 'en' },
      },
    } as unknown as ProductDetails;
    service.preview.mockImplementation(async (request) => ({
      rows: request.fields.map((field) => ({
        fieldRef: field.fieldRef,
        sourceLocale: field.sourceLocale,
        sourceText: field.sourceText,
        sourceHash: 'product-name-source-v1',
        targets: request.targetLocales.map((locale) => {
          if (field.fieldRef.fieldKey === 'name' && locale === 'fr') {
            return {
              locale,
              status: 'current',
              text: 'Pizza Margherita',
              provenance: { kind: 'manual' as const, sourceHash: 'product-name-source-v1' },
            };
          }
          if (locale === field.sourceLocale) {
            return {
              locale,
              status: 'current',
              text: field.sourceText,
              provenance: { kind: 'tenantSource' as const, sourceHash: 'product-name-source-v1' },
            };
          }
          const text = field.targetTexts?.[locale] ?? '';
          return { locale, status: text ? ('current' as const) : ('missing' as const), text };
        }),
      })),
    }));
    const suggestion: TranslationSuggestion = {
      suggestionId: 'manual-alt-fr',
      fieldRef: { entityType: 'product', entityId: 'item-1', fieldKey: 'name' },
      locale: 'fr',
      sourceHash: 'product-name-source-v1',
      text: 'Pizza Margherita artisanale',
      provider: 'test-provider',
      model: 'test-model',
      status: 'suggested',
    };
    service.suggest.mockImplementation(async (request) => ({
      providerStatus: 'ready',
      suggestions: request.generationIntent === 'explicitAlternative' ? [suggestion] : [],
      skipped: [],
    }));
    service.review.mockImplementation(async (decisions) => ({
      decisions: decisions.map((decision) => ({
        suggestionId: decision.suggestionId,
        decision: decision.decision,
        status: 'accepted' as const,
        text: suggestion.text,
      })),
    }));

    const { container, view } = await openWorkbench(product);
    selectLocale(view, 'Deutsch');
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Deutsch', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate und Mozzarella' } },
    );
    fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);
    const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
    const drawer = within(review).getByRole('complementary', { name: 'translation_review_title' });
    const requestAlternative = await within(drawer).findByRole('button', {
      name: 'translation_review_suggest_alternative_field[field=Margherita Pizza · item_name,language=Français]',
    });
    await waitFor(() => expect(requestAlternative).toBeEnabled());

    fireEvent.click(requestAlternative);
    await waitFor(() => expect(service.suggest).toHaveBeenCalledTimes(1));
    expect(service.suggest).toHaveBeenCalledWith(
      expect.objectContaining({
        generationIntent: 'explicitAlternative',
        targetLocales: ['fr'],
        fields: [expect.objectContaining({ fieldRef: suggestion.fieldRef })],
      }),
    );
    await within(drawer).findByLabelText('translation_review_suggested_text[language=Français]');
    expect(updateProduct).not.toHaveBeenCalled();
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: 'translation_review_accept_field[field=Margherita Pizza · item_name,language=Français]',
      }),
    );

    await act(async () => {
      fireEvent.click(within(review).getByRole('button', { name: 'editor_review_save' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
    const payload = (updateProduct as jest.Mock).mock.calls[0][1] as {
      content: Record<string, { name?: string; description?: string }>;
      translationMetadata: {
        expectedContentVersion?: string;
        acceptedSuggestionIds?: Record<string, string>;
      };
    };
    expect(payload.content.fr.name).toBe('Pizza Margherita artisanale');
    expect(payload.content.de).toEqual({ name: 'Margherita', description: 'Tomate und Mozzarella' });
    expect(payload.content.zh).toEqual({ name: '玛格丽特披萨', description: '番茄和马苏里拉奶酪' });
    expect(payload.translationMetadata).toMatchObject({
      expectedContentVersion: 'product-content-v9',
      acceptedSuggestionIds: { 'name.fr': 'manual-alt-fr' },
    });
  });
});

describe('bundle translation review', () => {
  it('accepts one locale while preserving the other bundle locales and echoes the content version', async () => {
    const service = translationWorkbenchService as jest.Mocked<TranslationWorkbenchAdapter>;
    const bundle = {
      ...margherita,
      id: 'bundle-1',
      type: 'menu',
      content: {
        de: { name: 'Pizza-Menü', description: 'Klassische Tomate und Mozzarella' },
        fr: { name: 'Menu Margherita', description: 'Tomate et mozzarella' },
        zh: { name: '玛格丽特套餐', description: '番茄和马苏里拉奶酪' },
      },
      translationMetadata: {
        expectedContentVersion: 'bundle-content-v12',
        sourceLocales: { name: 'en', description: 'en' },
      },
      menuDefinition: {
        ...EMPTY_MENU_DEFINITION,
        id: 'definition-1',
        sections: [
          {
            id: 'section-1',
            name: 'Choose a side',
            displayOrder: 0,
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            items: [{ id: 'option-1', productId: 'side-1', additionalPrice: 0, displayOrder: 0, isDefault: true }],
          },
        ],
      },
    } as unknown as ProductDetails;
    const suggestion: TranslationSuggestion = {
      suggestionId: 'bundle-suggestion-fr',
      fieldRef: { entityType: 'product', entityId: 'bundle-1', fieldKey: 'name' },
      locale: 'fr',
      sourceHash: 'bundle-name-source-v1',
      text: 'Menu Margherita maison',
      provider: 'test-provider',
      model: 'test-model',
      status: 'suggested',
    };
    service.preview.mockImplementation(async (request) => ({
      rows: request.fields
        .filter((field) => field.fieldRef.entityType === 'product' && field.fieldRef.fieldKey === 'name')
        .map((field) => ({
          fieldRef: field.fieldRef,
          sourceLocale: field.sourceLocale,
          sourceText: field.sourceText,
          sourceHash: 'bundle-name-source-v1',
          targets: LANGUAGE_CODES.map((locale) => ({
            locale,
            status: locale === 'fr' ? ('stale' as const) : ('current' as const),
            text: field.targetTexts?.[locale] ?? '',
            ...(locale === 'de' || locale === 'zh'
              ? { provenance: { kind: 'manual' as const, sourceHash: 'bundle-name-source-v1' } }
              : {}),
          })),
        })),
    }));
    service.suggest.mockResolvedValue({ providerStatus: 'ready', suggestions: [suggestion], skipped: [] });
    service.review.mockResolvedValue({
      decisions: [
        {
          suggestionId: suggestion.suggestionId,
          decision: 'accept',
          status: 'accepted',
          text: suggestion.text,
        },
      ],
    });

    const { container, view } = await openWorkbench(bundle, true);
    selectLocale(view, 'Deutsch');
    fireEvent.change(
      targetField(view, 'editor_translations_field_item_description', 'Deutsch', 'Classic tomato and mozzarella'),
      { target: { value: 'Tomate und Mozzarella' } },
    );
    fireEvent.click(container.querySelector('[data-testid="editor-save"]') as HTMLButtonElement);

    const review = await screen.findByRole('dialog', { name: 'editor_review_title' });
    const drawer = within(review).getByRole('complementary', { name: 'translation_review_title' });
    await waitFor(() => expect(service.suggest).toHaveBeenCalledTimes(1));
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: 'translation_review_accept_field[field=Margherita Pizza · item_name,language=Français]',
      }),
    );

    await act(async () => {
      fireEvent.click(within(review).getByRole('button', { name: 'editor_review_save' }));
      await Promise.resolve();
    });
    await waitFor(() => expect(updateMenuBundle).toHaveBeenCalledTimes(1));
    expect(updateProduct).not.toHaveBeenCalled();
    const [, payload] = (updateMenuBundle as jest.Mock).mock.calls[0] as [
      string,
      {
        content: Record<string, { name?: string; description?: string }>;
        translationMetadata: {
          expectedContentVersion?: string;
          acceptedSuggestionIds?: Record<string, string>;
        };
      },
    ];
    expect(payload.content).toEqual({
      de: { name: 'Pizza-Menü', description: 'Tomate und Mozzarella' },
      fr: { name: 'Menu Margherita maison', description: 'Tomate et mozzarella' },
      zh: { name: '玛格丽特套餐', description: '番茄和马苏里拉奶酪' },
    });
    expect(payload.translationMetadata).toMatchObject({
      expectedContentVersion: 'bundle-content-v12',
      acceptedSuggestionIds: { 'name.fr': suggestion.suggestionId },
    });
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
    await confirmSaveReview(container);

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

    await confirmSaveReview(container);

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
        'editor_error_summary_in_section[count=1,section=editor_section_pricing]',
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
