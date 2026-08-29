import React from 'react';
import { act, render, fireEvent, screen, waitFor } from '@testing-library/react';
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
  // S9: the side-item picker searches the menu server-side. One extra row, so the picker has
  // something to ADD that the product does not already suggest.
  searchProducts: jest.fn(async () => ({
    success: true,
    data: { items: [{ id: 'side-2', name: 'Coleslaw', description: '', basePrice: 3, type: 'sideItem' }] },
  })),
}));
// S9: `useSideItemDetails` names each suggested id, one read per id.
jest.mock('@/services/menuService', () => ({
  createProduct: jest.fn(),
  getProductById: jest.fn(async (id: string) => ({
    success: true,
    data: { id, name: id === 'side-1' ? 'Garlic bread' : id, description: '' },
  })),
}));
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
const GLOBAL_VARIATION_ID = 'glob-var-1';
const INGREDIENT_ID = 'ing-1';
const SAUCE_ID = 'sauce-1';
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
      // Provenance from the variation library (plan S4). It has NO input on the page and never
      // will: it is a record of where the name came from, not a thing to edit.
      globalVariationId: GLOBAL_VARIATION_ID,
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
    // A SAUCE (SHARED-MODIFIERS-AND-SAUCES-PLAN D8). It is rendered by the other of the two groups,
    // which is exactly why it belongs here: the split is where a row goes missing from the payload.
    {
      id: SAUCE_ID,
      name: 'Chilli oil',
      kind: 'sauce',
      isOptional: true,
      price: 1,
      isActive: true,
      displayOrder: 2,
      globalIngredientId: 'glob-2',
    },
  ],
  images: [{ id: 'img-1', url: '/uploads/margherita.jpg', altText: NAME, isPrimary: true, sortOrder: 0 }],
  suggestedSideItems: [{ id: SIDE_ITEM_ID, name: 'Garlic bread', description: '', price: 4 }],
  availableOrderTypes: 3,
  sauceMin: 1,
  sauceMax: 3,
  sauceIncludedFree: 1,
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
        // The one field here with TWO independent ways of being dropped, which is why it is worth
        // naming: `variationSchema` must declare it or `zodResolver` strips it before the payload
        // builder is even called, and `cleanedVariations` must list it or the builder's whitelist
        // drops it after. Fixing either alone still writes null on every save of a linked product.
        globalVariationId: GLOBAL_VARIATION_ID,
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
      { id: SAUCE_ID, name: 'Chilli oil', kind: 'sauce', price: 1 },
    ]);
    expect(createGlobalIngredient).not.toHaveBeenCalled();
  });

  /**
   * The sauces split (SHARED-MODIFIERS-AND-SAUCES-PLAN D8/D9) is the newest way to lose a field on
   * a save that changed nothing: the rows are drawn by TWO components over ONE array, and the three
   * group numbers are product columns the PUT assigns unconditionally.
   */
  describe('the sauce group', () => {
    it('sends both kinds back in one array, in the order it loaded them', async () => {
      const payload = await renderAndSaveUntouched(fullyPopulated);
      const rows = payload.detailedIngredients as Array<{ id: string; kind?: string }>;

      expect(rows.map((row) => row.id)).toEqual([INGREDIENT_ID, SAUCE_ID]);
      // The ingredient predates the discriminator and must not gain one it never had.
      expect(rows[0].kind).toBeUndefined();
      expect(rows[1].kind).toBe('sauce');
    });

    it('round-trips the three group numbers through the form', async () => {
      const payload = await renderAndSaveUntouched(fullyPopulated);

      expect(payload.sauceMin).toBe(1);
      expect(payload.sauceMax).toBe(3);
      expect(payload.sauceIncludedFree).toBe(1);
    });

    /**
     * `null` is NO CAP and `0` is "no sauce may be picked" — two different rules. `Number('')` is 0,
     * so an emptied input that fell through `z.coerce.number()` would silently forbid every sauce
     * on a product whose admin meant to remove the limit.
     */
    it('sends null, never 0, when the maximum is cleared', async () => {
      const { container } = render(
        <ProductEditorPage
          product={fullyPopulated}
          isBundle={false}
          mode="edit"
          onSaved={jest.fn()}
          onBack={jest.fn()}
        />,
      );
      await act(async () => {});

      fireEvent.change(container.querySelector('input[name="sauceMax"]') as HTMLInputElement, {
        target: { value: '' },
      });
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
      await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));

      const payload = (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(payload.sauceMax).toBeNull();
      expect(payload.sauceMin).toBe(1);
    });

    it('never seeds a tenant default for a product that carries no rule', async () => {
      const payload = await renderAndSaveUntouched({
        ...fullyPopulated,
        sauceMin: undefined,
        sauceMax: undefined,
        sauceIncludedFree: undefined,
      } as unknown as ProductDetails);

      expect(payload.sauceMin).toBe(0);
      expect(payload.sauceMax).toBeNull();
      expect(payload.sauceIncludedFree).toBe(0);
    });
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
    // A three-button group. It left `Details` for `Service & availability` in S2 (§4) — the move
    // this assertion exists to survive.
    expect(payload.kitchenType).toBe('BackKitchen');
    // Meaningful only with variations, and D7 makes it conditional in S8.
    expect(payload.hideBaseProduct).toBe(true);
    // null means "inherit"; 3 is an explicit override that must never collapse back to null.
    expect(payload.availableOrderTypes).toBe(3);
    // Set through a picker in its own section — the payload key is not the section's name.
    expect(payload.suggestedSideItemIds).toEqual([SIDE_ITEM_ID]);
  });

  /**
   * S9 / D12 — the picker that can ADD and REMOVE.
   *
   * `suggestedSideItemIds` was already named in the assertion above as a field the page shows only
   * through a picker. It is now a field the page can CHANGE in two directions, and both of them run
   * through `setValue` on a value nothing registers as an input — the same shape §13.9 found in the
   * translations panel. So the payload is the only place either direction can be proven.
   *
   * The removal assertion is the one that fails against the code this replaces: `saveSelected`
   * merged (`[...selectedSideItemIds, ...tempSelectedIds]`), so an untick reached neither the form
   * nor the PUT.
   */
  describe('the side-item picker', () => {
    const openPicker = async (container: HTMLElement) => {
      const open = await screen.findByRole('button', { name: 'side_items_picker_open' });
      fireEvent.click(open);
      return container;
    };

    const submitAndRead = async (container: HTMLElement) => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
      await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
      return (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    };

    const renderEditor = async () => {
      const view = render(
        <ProductEditorPage
          product={fullyPopulated}
          isBundle={false}
          mode="edit"
          onSaved={jest.fn()}
          onBack={jest.fn()}
        />,
      );
      await act(async () => {});
      return view.container;
    };

    it('a side item added in the picker reaches the PUT, alongside the one already there', async () => {
      const container = await renderEditor();
      await openPicker(container);

      // Real timers, and `findBy…` rather than `advanceTimersByTime`: the search debounce is 300ms
      // and the poll outlasts it. Fake timers here would have to be faked for the whole file, which
      // every other test in it is written without.
      fireEvent.change(screen.getByPlaceholderText('search_placeholder'), { target: { value: 'coleslaw' } });
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Coleslaw' }));
      fireEvent.click(screen.getByRole('button', { name: 'apply' }));

      const payload = await submitAndRead(container);

      // The oracle is the FIXTURE: `fullyPopulated.suggestedSideItems` is what the server sent, and
      // the added id is the one the mocked search returned. Neither number is computed here.
      expect(payload.suggestedSideItemIds).toEqual([SIDE_ITEM_ID, 'side-2']);
    });

    it('a side item removed in the picker is absent from the PUT', async () => {
      const container = await renderEditor();
      await openPicker(container);

      // The control that makes this non-trivial: the row is TICKED when the picker opens, so the
      // click is genuinely an untick and not a first selection.
      const garlic = await screen.findByRole('checkbox', { name: 'Garlic bread' });
      expect(garlic).toBeChecked();
      fireEvent.click(garlic);
      fireEvent.click(screen.getByRole('button', { name: 'apply' }));

      const payload = await submitAndRead(container);

      expect(payload.suggestedSideItemIds).toEqual([]);
      // …and the save is otherwise untouched, so the removal is the only thing that moved.
      expect(payload.displayOrder).toBe(7);
      expect(payload.availableOrderTypes).toBe(3);
    });
  });

  /**
   * S2 moved ~150 controls between sections, and two of those moves put a registered field somewhere
   * a naive implementation would have unmounted it — inside the collapsed `Advanced` card, and in
   * the side rail, which is a SIBLING of the form. Both still have to reach the PUT, because the
   * command assigns every column it is given: an item whose type quietly became the default, or
   * whose `isActive` came back `false`, is off the menu.
   */
  it('sends the Advanced fields while the Advanced section is collapsed', async () => {
    const { container } = render(
      <ProductEditorPage
        product={fullyPopulated}
        isBundle={false}
        mode="edit"
        onSaved={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    await act(async () => {});

    // The premise: this is the only collapsed section, and it IS collapsed on a first visit (D1).
    expect(container.querySelector('#editor-section-advanced-body')).toHaveAttribute('hidden');

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));

    const payload = (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload.type).toBe(ITEM_TYPE);
    expect(payload.hideBaseProduct).toBe(true);
  });

  it('sends a status flag toggled in the side rail, which sits outside the form element', async () => {
    const { container } = render(
      <ProductEditorPage
        product={fullyPopulated}
        isBundle={false}
        mode="edit"
        onSaved={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    await act(async () => {});

    const rail = container.querySelector('aside') as HTMLElement;
    const special = rail.querySelector('#product-special') as HTMLInputElement;
    expect(special.checked).toBe(true);
    fireEvent.click(special);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));

    const payload = (updateProduct as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    // react-hook-form submits its own store, not the DOM under the <form> — the same property §8.2
    // relies on for the translations panel. If that ever stopped being true, this flips silently.
    expect(payload.isSpecial).toBe(false);
    expect(payload.isActive).toBe(true);
    expect(payload.isAvailable).toBe(false);
  });

  it('never invents a menu definition for a plain item', async () => {
    const payload = await renderAndSaveUntouched(fullyPopulated);

    // A defined menuDefinition would route the item's save to the BUNDLE endpoint.
    expect(payload.menuDefinition).toBeUndefined();
  });
});

/**
 * §6's PUT-clears trap, applied to the surface S4 rebuilt.
 *
 * The Translations tab now owns three DIFFERENT stores at once — the product's `content` array, a
 * variation's keyed map and the ingredients, which are not in react-hook-form at all — and it
 * shows exactly one locale at a time. So the failure mode is specific and silent: open the tab on
 * French, save, and every other language is gone. Nothing else in the suite would notice.
 */
describe('translations survive a save that did not touch them', () => {
  const manyLocales = {
    ...fullyPopulated,
    content: {
      en: { name: NAME, description: DESCRIPTION },
      fr: { name: 'Margherita', description: 'Tomate, mozzarella, basilic' },
      // The three the old ingredient seed omitted — present here so a re-introduced literal list
      // could not quietly pass this file.
      nl: { name: 'Margherita', description: 'Tomaat, mozzarella, basilicum' },
      ru: { name: 'Маргарита', description: 'Томат, моцарелла, базилик' },
      zh: { name: '玛格丽特', description: '番茄、马苏里拉、罗勒' },
    },
  } as unknown as ProductDetails;

  it('sends back every locale of the product, not just the one the tab was showing', async () => {
    const payload = await renderAndSaveUntouched(manyLocales);

    expect(Object.keys(payload.content as Record<string, unknown>).sort()).toEqual(['en', 'fr', 'nl', 'ru', 'zh']);
    expect((payload.content as Record<string, { description: string }>).zh.description).toBe('番茄、马苏里拉、罗勒');
  });

  it("keeps a variation's and an ingredient's own translations", async () => {
    const payload = await renderAndSaveUntouched(manyLocales);

    expect((payload.variations as { content: Record<string, unknown> }[])[0].content).toEqual({
      fr: { name: 'Grande', description: 'trente-deux cm' },
    });
    expect((payload.detailedIngredients as { content: Record<string, unknown> }[])[0].content).toEqual({
      fr: { name: 'Mozzarella de bufflonne' },
    });
  });
});

/**
 * S10's meter is DERIVED, and this is the proof it stays that way.
 *
 * The rail reads `description` and `allergens` to decide what to say about them. Both are fields the
 * PUT assigns unconditionally, so a read that accidentally became a write — a `setValue` to
 * normalise a blank description, a default `[]` seeded to make a rule easier to express — would
 * clear stored data on a save nobody asked for. The fixture is chosen to be the WORST case for that:
 * it is the item the meter reports as least complete.
 */
describe('the completeness meter reads the form and never writes to it', () => {
  const incomplete = {
    ...fullyPopulated,
    description: '',
    images: [],
    allergens: [],
  } as unknown as ProductDetails;

  it('sends an empty description back as an empty description', async () => {
    const payload = await renderAndSaveUntouched(incomplete);
    expect(payload.description).toBe('');
    // …and the per-locale copy is untouched, which is the field a "helpful" backfill would reach for.
    expect(payload.content).toEqual({ en: { name: NAME, description: DESCRIPTION } });
  });

  it('sends the UNSCORED allergen list back exactly as it was, empty', async () => {
    // The §14 decision has a payload consequence: the meter has no opinion about allergens, so it
    // must also leave no trace of them. An empty array must arrive as an empty array — neither
    // dropped (which would clear a list on a product that HAS one) nor filled with a token.
    const payload = await renderAndSaveUntouched(incomplete);
    expect(payload.allergens).toEqual([]);
  });

  it('leaves a POPULATED allergen list alone on the same code path', async () => {
    // The control: the assertion above passes vacuously if the payload builder simply never sends
    // allergens. This one fails if it does not send them.
    const payload = await renderAndSaveUntouched(fullyPopulated);
    expect(payload.allergens).toEqual(['gluten', 'milk']);
  });
});
