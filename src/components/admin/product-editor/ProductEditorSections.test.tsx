import React from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
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
  getCategories: jest.fn(async () => ({ success: true, data: { items: [{ id: 'cat-a', name: 'Pizza' }] } })),
}));

/**
 * Slice S2 — the section extraction (MENU-ITEM-EDITOR-REDESIGN-PLAN §4).
 *
 * Two things are being pinned here:
 *
 * 1. the nine flat groups of §1 are now the SEVEN named sections of §4, presented as focused tabs;
 * 2. **not one control was lost on the way.** The re-group moved ~150 controls between parents; the
 *    audit (`docs/plans/_research/menu-item-editor-audit.md`) is the list of what must still be
 *    there, and the second describe block is that list turned into assertions. A field that
 *    silently stops rendering is not a cosmetic bug: the PUT assigns every column it receives, so
 *    the save that follows CLEARS it (plan §6).
 */
const SECTION_LABELS = [
  'editor_section_basics',
  'editor_section_media',
  'editor_section_pricing',
  'editor_section_options',
  'customer_flow_section_title',
  'editor_section_recipe',
  'editor_section_service',
  'editor_section_advanced',
];

const ADVANCED_BODY = '#editor-section-advanced-body';

const item: ProductDetails = {
  id: 'item-1',
  name: 'Margherita',
  description: 'A pizza',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  hideBaseProduct: false,
  preparationTimeMinutes: 10,
  type: 'mainItem',
  kitchenType: 'BackKitchen',
  ingredients: [],
  allergens: ['contains_gluten'],
  categories: [{ categoryId: 'cat-a', categoryName: 'Pizza', isPrimary: true }],
  primaryCategory: { id: 'cat-a', name: 'Pizza' },
  variations: [],
  images: [],
  suggestedSideItems: [],
  content: { en: { name: 'Margherita', description: 'A pizza' } },
} as unknown as ProductDetails;

const renderEditor = async (product: ProductDetails = item, mode: 'create' | 'edit' = 'edit') => {
  const view = render(
    <ProductEditorPage product={product} isBundle={false} mode={mode} onSaved={jest.fn()} onBack={jest.fn()} />,
  );
  // The categories fetch resolves after mount; flush it so its state update lands inside act().
  await act(async () => {});
  return view;
};

const navEntries = (container: HTMLElement) =>
  Array.from(
    (container.querySelector('[role="tablist"][aria-label="editor_sections"]') as HTMLElement).querySelectorAll(
      '[role="tab"]',
    ),
  );

beforeEach(() => jest.clearAllMocks());

describe('the editor sections', () => {
  it('renders them in order, and names each one in the nav', async () => {
    const { container } = await renderEditor();

    expect(navEntries(container).map((button) => button.textContent)).toEqual(SECTION_LABELS);
    // The nav and the matching tabpanels share the same order and ids.
    expect(Array.from(container.querySelectorAll('section[id^="editor-section-"]')).map((node) => node.id)).toEqual([
      'editor-section-basics',
      'editor-section-media',
      'editor-section-pricing',
      'editor-section-options',
      'editor-section-customer-screens',
      'editor-section-recipe',
      'editor-section-service',
      'editor-section-advanced',
    ]);
  });

  it('keeps every section mounted while hiding inactive section panels', async () => {
    const { container } = await renderEditor();

    const advanced = container.querySelector(ADVANCED_BODY) as HTMLElement;
    expect(advanced.querySelector('#product-is-component')).not.toBeNull();
    expect(advanced).not.toHaveAttribute('hidden');
    expect(container.querySelector('#product-editor-form-section-panel-editor-section-advanced')).toHaveAttribute(
      'hidden',
    );
    expect(container.querySelectorAll('section[id^="editor-section-"]')).toHaveLength(SECTION_LABELS.length);
  });

  it('selects the section tab and reveals its matching panel', async () => {
    const { container } = await renderEditor();

    fireEvent.click(screen.getByRole('tab', { name: 'editor_section_recipe' }));

    expect(screen.getByRole('tab', { name: 'editor_section_recipe' })).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('#product-editor-form-section-panel-editor-section-recipe')).not.toHaveAttribute(
      'hidden',
    );
  });
});

/**
 * Every control the audit inventories, found through the SECTION that now owns it. The point is not
 * that the DOM contains an input somewhere — it is that the re-group put each one where §4 says.
 */
const sectionOf = (container: HTMLElement, id: string) => {
  const tab = container.querySelector(
    `[role="tab"][aria-controls="product-editor-form-section-panel-${id}"]`,
  ) as HTMLButtonElement | null;
  if (tab && tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab);
  return container.querySelector(`#${id}`) as HTMLElement;
};

describe('nothing was dropped on the way — the audit inventory, by section', () => {
  it('Basics keeps name, description, the category chips, the primary star and the item type', async () => {
    const { container } = await renderEditor();
    const basics = sectionOf(container, 'editor-section-basics');

    expect(basics.querySelector('input[name="name"]')).not.toBeNull();
    expect(basics.querySelector('textarea[name="description"]')).not.toBeNull();
    expect(basics.querySelector('#category-chip-cat-a')).not.toBeNull();
    // The separate `select[name="primaryCategoryId"]` is GONE, and the field is not: the primary is
    // now a star on the ticked chips, which is one control where there were two. The type select
    // arrived here from Advanced in the same change.
    expect(basics.querySelector('select[name="primaryCategoryId"]')).toBeNull();
    expect(basics.querySelector('input[name="primary-category-star"]')).not.toBeNull();
    expect(basics.querySelector('select[name="type"]')).not.toBeNull();
  });

  // S3 deleted the fork this used to pin. An item has no create page any more (D3), so Media is
  // the gallery and only the gallery — and an unsaved item has no Media section at all, because
  // images are sub-resources of a SAVED product and an empty card would promise otherwise.
  //
  // S6 changed the anchor: the gallery's own `<h3>` is gone (G16), so the thing that identifies it
  // is D5's autosave notice — which is also the assertion that the notice is PERSISTENT rather
  // than a toast, since nothing has been clicked here.
  it('Media is the gallery, and is absent entirely on an unsaved item', async () => {
    const { container, unmount } = await renderEditor();
    expect(
      within(sectionOf(container, 'editor-section-media')).getByText('editor_media_autosave_notice'),
    ).toBeInTheDocument();
    expect(container.querySelector('#product-images')).toBeNull();

    unmount();
    const created = await renderEditor({ ...item, id: '', images: [] } as ProductDetails, 'create');
    expect(created.container.querySelector('#editor-section-media')).toBeNull();
    expect(created.container.querySelector('#product-images')).toBeNull();
  });

  it('Pricing keeps the base price and the variation rows together', async () => {
    const { container } = await renderEditor();
    const pricing = sectionOf(container, 'editor-section-pricing');

    expect(pricing.querySelector('input[name="basePrice"]')).not.toBeNull();
    expect(within(pricing).getByRole('button', { name: 'add_variation' })).toBeInTheDocument();
  });

  it('Options contains guest choice groups and separately priced suggested sides', async () => {
    const { container } = await renderEditor();
    expect(
      within(sectionOf(container, 'editor-section-options')).getByRole('heading', { name: 'customization_groups' }),
    ).toBeInTheDocument();
    expect(
      within(sectionOf(container, 'editor-section-options')).getByRole('heading', { name: /suggested_side_items/ }),
    ).toBeInTheDocument();
  });

  it('Recipe keeps the ingredient rows and all sixteen allergen chips', async () => {
    const { container } = await renderEditor();
    const recipe = sectionOf(container, 'editor-section-recipe');

    // TWO groups now (SHARED-MODIFIERS-AND-SAUCES-PLAN D8) — Ingredients and Sauces — each with its
    // own manual-add. The section keeps its id, its name and its place in §4's order.
    expect(within(recipe).getAllByRole('button', { name: 'add_manually' })).toHaveLength(2);
    expect(within(recipe).getByRole('heading', { name: 'ingredients' })).toBeInTheDocument();
    expect(within(recipe).getByRole('heading', { name: 'sauces' })).toBeInTheDocument();
    expect(recipe.querySelectorAll('input[id^="allergen-chip-"]')).toHaveLength(16);
    // Seeded from the product, so the chips are the same control and not a fresh empty one.
    expect(recipe.querySelector('#allergen-chip-contains_gluten')).toBeChecked();
  });

  it('Service keeps the kitchen type, the prep time and the order-type mask', async () => {
    const { container } = await renderEditor();
    const service = sectionOf(container, 'editor-section-service');

    // A RADIO since S8, not a button: kitchen type is one choice out of three, and the row of
    // buttons it replaced announced no selected state and no group name. The role is the assertion
    // that matters — a regression back to buttons is exactly what this line now catches.
    expect(within(service).getByRole('radio', { name: 'kitchen_type_backkitchen' })).toBeInTheDocument();
    expect(service.querySelector('input[name="preparationTimeMinutes"]')).not.toBeNull();
    // The order-type mask's override, asserted BY ROLE. It was an inherit/custom radio pair until
    // S5 (D6) made it one switch: inherit is the DEFAULT and an override is a departure from it,
    // which is what `role="switch"` says and two peer radios did not. Counting `input[type="radio"]`
    // in the section would silently measure the kitchen type instead, which is why this line names
    // the role it means rather than the markup it happens to find.
    expect(within(service).getAllByRole('switch')).toHaveLength(1);
    expect(service.querySelectorAll('input[type="radio"][name="product-kitchen-type"]')).toHaveLength(3);
  });

  it('Advanced keeps the option-only flag, and nothing else', async () => {
    const { container } = await renderEditor();
    const advanced = sectionOf(container, 'editor-section-advanced');

    expect(advanced.querySelector('#product-is-component')).not.toBeNull();
    // Both of its former controls left, and they left for the same reason: they were filed by how
    // often they are touched rather than by what they are about. The type is in Basics;
    // `hideBaseProduct` is the ACTIVE switch on the variations table's own base row.
    expect(advanced.querySelector('select[name="type"]')).toBeNull();
    expect(advanced.querySelector('#product-hide-base')).toBeNull();
  });

  /**
   * `hideBaseProduct` followed the base row into Pricing. This fixture's item has NO variations, so
   * the row is not drawn — and the field must still be registered, which is the §6 rule the section
   * above states for a collapsed body and this one states for a table with nothing in it. An item
   * that withholds its base row and then loses its variations must not have that column silently
   * rewritten by the next save; its variations may come back.
   */
  it('keeps hideBaseProduct registered in Pricing even with no variations to draw it on', async () => {
    const { container } = await renderEditor();
    const pricing = sectionOf(container, 'editor-section-pricing');

    expect(pricing.querySelector('#variation-base-active')).toBeNull();
    expect(pricing.querySelector('input[name="hideBaseProduct"]')).not.toBeNull();
  });

  it('puts the three status flags in the rail, where every section can see them', async () => {
    const { container } = await renderEditor();
    const rail = container.querySelector('aside') as HTMLElement;

    expect(rail.querySelector('#product-active')).toBeChecked();
    expect(rail.querySelector('#product-available')).toBeChecked();
    expect(rail.querySelector('#product-special')).not.toBeChecked();
    // They left `Details`, they did not multiply: exactly one control per flag on the page.
    expect(container.querySelectorAll('#product-active')).toHaveLength(1);
  });

  // The CONSUMPTION half of #575. `Switch.test.tsx` proves the component is a switch; without this
  // the component could be perfect and the rail could still ship the checkbox chips it replaces.
  it('renders each flag as the design system Switch, not as a checkbox chip', async () => {
    const { container } = await renderEditor();
    const rail = container.querySelector('aside') as HTMLElement;

    expect(
      within(rail)
        .getAllByRole('switch')
        .map((node) => node.id),
    ).toEqual(['product-active', 'product-available', 'product-special']);
    // `register()` still owns them, so the PUT is unchanged — the round-trip test is the other half.
    expect(rail.querySelector('#product-active')).toHaveAttribute('name', 'isActive');
    expect(within(rail).queryAllByRole('checkbox')).toHaveLength(0);
  });

  /**
   * The rail is now a form surface, so it may not unmount with the tab — the same rule as the
   * inactive panel, for the harder reason that these three are registered fields.
   */
  it('hides the rail on the Translations tab instead of unmounting it', async () => {
    const { container } = await renderEditor();

    fireEvent.click(container.querySelector('[role="tab"][aria-controls$="panel-translations"]') as HTMLElement);

    const rail = container.querySelector('aside') as HTMLElement;
    expect(rail).toHaveAttribute('hidden');
    expect(rail.querySelector('#product-active')).not.toBeNull();
  });
});
