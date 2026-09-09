import { renderHook, act } from '@testing-library/react';
import { useBundleCustomizationSheet } from './useBundleCustomizationSheet';
import type { MenuBundleItem, MenuSection } from '@/types/menu';
import { ApiError } from '@/utils/apiClient';

const mockAddItem = jest.fn().mockResolvedValue(undefined);
const mockEnqueueSnackbar = jest.fn();

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f || _k, i18n: { language: 'en' } }),
}));

const cheese = {
  id: 'cheese',
  name: 'Cheese',
  price: 2,
  isOptional: true,
  isActive: true,
  isIncludedInBasePrice: true,
  maxQuantity: 3,
  displayOrder: 1,
};
const bacon = {
  id: 'bacon',
  name: 'Bacon',
  price: 3,
  isOptional: true,
  isActive: true,
  isIncludedInBasePrice: false,
  maxQuantity: 2,
  displayOrder: 2,
};

const bundle: MenuBundleItem = {
  id: 'combo',
  name: 'Lunch Combo',
  content: { en: { name: 'Lunch Combo', description: 'Burger and a drink' } },
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 1,
  menuDefinition: {
    id: 'md1',
    isAlwaysAvailable: true,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [
      {
        id: 'main',
        name: 'Main',
        displayOrder: 1,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          {
            id: 'si-burger',
            productId: 'burger',
            productName: 'Burger',
            additionalPrice: 4,
            displayOrder: 1,
            isDefault: true,
            detailedIngredients: [cheese, bacon],
          },
        ],
      },
      {
        id: 'drink',
        name: 'Drink',
        displayOrder: 2,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [
          {
            id: 'si-coke',
            productId: 'coke',
            productName: 'Coke',
            additionalPrice: 0,
            displayOrder: 1,
            isDefault: false,
          },
          {
            id: 'si-water',
            productId: 'water',
            productName: 'Water',
            additionalPrice: 1,
            displayOrder: 2,
            isDefault: false,
          },
        ],
      },
    ],
  },
};

beforeEach(() => {
  mockAddItem.mockClear();
  mockEnqueueSnackbar.mockClear();
});

describe('useBundleCustomizationSheet', () => {
  it("falls back to the combo's plain description when no translation carries one (F3)", () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());

    act(() =>
      result.current.openForBundle({
        ...bundle,
        content: { en: { name: 'Lunch Combo', description: '' } },
        description: 'Burger and a drink',
      }),
    );

    expect(result.current.description).toBe('Burger and a drink');
  });

  it('opens seeded with each section default and the child base recipe, priced at the advertised total', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());

    act(() => result.current.openForBundle(bundle));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.title).toBe('Lunch Combo');
    expect(result.current.description).toBe('Burger and a drink');
    // The burger is the only isDefault option; its base recipe preselects the included cheese
    // (free in base) and leaves the paid bacon out — so the line starts at 20 + 4, delta 0.
    expect(result.current.selectedOptions).toEqual([
      {
        sectionId: 'main',
        itemId: 'burger',
        quantity: 1,
        selectedIngredients: ['cheese'],
        ingredientQuantities: { cheese: 1 },
      },
    ]);
    expect(result.current.linePrice.unitPrice).toBe(24);
    expect(result.current.linePrice.total).toBe(24);
  });

  it('refuses to open a bundle with no menu definition', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());

    act(() => result.current.openForBundle({ ...bundle, menuDefinition: undefined } as unknown as MenuBundleItem));

    expect(result.current.isOpen).toBe(false);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: 'error' });
  });

  it('blocks the add while a required section is unmet, and surfaces only then', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));

    // A freshly-opened sheet does not greet the guest with red text.
    expect(result.current.visibleErrors).toEqual([]);

    act(() => {
      void result.current.addToCart();
    });

    expect(mockAddItem).not.toHaveBeenCalled();
    expect(result.current.visibleErrors).toEqual([{ sectionId: 'drink', minSelection: 1 }]);
  });

  it('clears a section error as soon as it is satisfied, and then adds', async () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => {
      void result.current.addToCart();
    });

    const drinkSection = bundle.menuDefinition.sections[1];
    act(() => result.current.toggleOption(drinkSection, 'water'));

    expect(result.current.visibleErrors).toEqual([]);
    expect(result.current.linePrice.unitPrice).toBe(25); // 20 base + 4 burger + 1 water

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockAddItem).toHaveBeenCalledWith({
      productId: 'combo',
      quantity: 1,
      specialInstructions: undefined,
      selectedMenuOptions: [
        {
          sectionId: 'main',
          itemId: 'burger',
          quantity: 1,
          selectedIngredients: ['cheese'],
          ingredientQuantities: { cheese: 1 },
        },
        { sectionId: 'drink', itemId: 'water', quantity: 1 },
      ],
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('prices a drill-in ingredient change and carries it into the add payload', async () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));

    // Guest adds the paid bacon to the burger: +3 on top of the 24 advertised.
    act(() =>
      result.current.setOptionCustomization('main', 'burger', {
        selectedIngredients: ['cheese', 'bacon'],
        ingredientQuantities: { cheese: 1, bacon: 1 },
      }),
    );

    expect(result.current.linePrice.unitPrice).toBe(27);

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedMenuOptions: expect.arrayContaining([
          expect.objectContaining({ itemId: 'burger', selectedIngredients: ['cheese', 'bacon'] }),
        ]),
      }),
    );
  });

  it('deducts a removed included-in-base child ingredient and sends the removal as quantity 0', async () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));

    // Guest drops the cheese that comes free in the base: −2 off the 24 advertised. The explicit
    // 0 is what lets the kitchen ticket print "NO Cheese" (issue #150).
    act(() =>
      result.current.setOptionCustomization('main', 'burger', {
        selectedIngredients: [],
        ingredientQuantities: { cheese: 0 },
      }),
    );

    expect(result.current.linePrice.unitPrice).toBe(22);

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedMenuOptions: expect.arrayContaining([
          expect.objectContaining({
            itemId: 'burger',
            selectedIngredients: [],
            ingredientQuantities: { cheese: 0 },
          }),
        ]),
      }),
    );
  });

  it('multiplies the line by quantity and carries a bundle-level special request', async () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));

    act(() => result.current.setQuantity(3));
    act(() => result.current.setSpecialInstructions('no napkins'));

    expect(result.current.linePrice.total).toBe(72); // 24 × 3

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3, specialInstructions: 'no napkins' }),
    );
  });

  it('opens and closes the per-option customization screen', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));

    act(() => result.current.openOptionCustomization('main', 'burger'));
    expect(result.current.customizingOption).toEqual({ sectionId: 'main', itemId: 'burger' });

    act(() => result.current.closeOptionCustomization());
    expect(result.current.customizingOption).toBeNull();
  });

  it('closes the option screen when the option being customized is deselected', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));
    act(() => result.current.openOptionCustomization('drink', 'coke'));
    expect(result.current.customizingOption).toEqual({ sectionId: 'drink', itemId: 'coke' });

    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));
    expect(result.current.customizingOption).toBeNull();
  });

  it('resets the option screen when the sheet closes', async () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.openOptionCustomization('main', 'burger'));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));

    await act(async () => {
      await result.current.addToCart();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.customizingOption).toBeNull();
  });

  it('fires onAdded only after a successful add', async () => {
    const onAdded = jest.fn();
    const { result } = renderHook(() => useBundleCustomizationSheet({ onAdded }));
    act(() => result.current.openForBundle(bundle));

    act(() => {
      void result.current.addToCart();
    });
    expect(onAdded).not.toHaveBeenCalled(); // blocked by the unmet required section

    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));
    await act(async () => {
      await result.current.addToCart();
    });

    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open and reports failure when the add rejects', async () => {
    mockAddItem.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));

    await act(async () => {
      await result.current.addToCart();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: 'error' });
  });

  it("shows the server's own reason when the bundle is blocked on the basket's order type", async () => {
    mockAddItem.mockRejectedValueOnce(
      new ApiError(
        400,
        'Lunch Combo is not available for Delivery. Available for: DineIn, Takeaway.',
        undefined,
        'OrderTypeNotAvailable',
      ),
    );
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));
    act(() => result.current.toggleOption(bundle.menuDefinition.sections[1], 'coke'));

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'Lunch Combo is not available for Delivery. Available for: DineIn, Takeaway.',
      { variant: 'error' },
    );
  });

  it('selects a fixed Plat deterministically even before its tenant-data default is written', () => {
    const fixedPlatBundle: MenuBundleItem = {
      ...bundle,
      menuDefinition: {
        ...bundle.menuDefinition,
        sections: [
          {
            ...bundle.menuDefinition.sections[0],
            name: 'Plat',
            items: [{ ...bundle.menuDefinition.sections[0].items[0], isDefault: false }],
          },
        ],
      },
    };
    const { result } = renderHook(() => useBundleCustomizationSheet());

    act(() => result.current.openForBundle(fixedPlatBundle));

    expect(result.current.selectedOptions).toEqual([
      {
        sectionId: 'main',
        itemId: 'burger',
        quantity: 1,
        selectedIngredients: ['cheese'],
        ingredientQuantities: { cheese: 1 },
      },
    ]);
  });
});

describe('the guided option walk (partner feedback 2026-09)', () => {
  // One factory per shape, so no two multi-line literals in this file (or in the sheet's e2e
  // specs) repeat a 10-line stretch — the PR delta is what Sonar's duplication gate reads.
  // Derived from the fixture's own `cheese` literal: a second 8-property ingredient literal is a
  // structural duplicate, which is exactly what the Sonar delta gate counts.
  const sideIngredient = { ...cheese, id: 'onion', name: 'Onion', price: 0, isOptional: false };
  const sideItem = (productId: string, productName: string, displayOrder: number, withIngredients: boolean) => ({
    id: `si-${productId}`,
    productId,
    productName,
    additionalPrice: 0,
    displayOrder,
    isDefault: false,
    ...(withIngredients ? { detailedIngredients: [sideIngredient] } : {}),
  });
  // Spread of the drink section's shape + overrides — no second free-standing section literal.
  const sidesSection: MenuSection = {
    ...bundle.menuDefinition.sections[1],
    id: 'sides',
    name: 'Sides',
    minSelection: 1,
    maxSelection: 2,
    items: [
      sideItem('fries', 'Fries', 1, true),
      sideItem('salad', 'Salad', 2, true),
      sideItem('soup', 'Soup', 3, false),
    ],
  };
  /** A multi-select section whose options carry their own ingredients, beside the combo's main. */
  const walkingBundle: MenuBundleItem = {
    ...bundle,
    menuDefinition: { ...bundle.menuDefinition, sections: [bundle.menuDefinition.sections[0], sidesSection] },
  };

  it('starts the walk at the FIRST selected option that carries its own customization', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));
    act(() => result.current.toggleOption(sidesSection, 'salad'));
    act(() => result.current.toggleOption(sidesSection, 'fries'));

    let started = false;
    act(() => {
      started = result.current.beginOptionTour(sidesSection);
    });
    expect(started).toBe(true);
    expect(result.current.optionTourSectionId).toBe('sides');
    // Section order, not pick order: fries sits before salad.
    expect(result.current.customizingOption).toEqual({ sectionId: 'sides', itemId: 'fries' });
  });

  it('reports nothing to walk when no selected option carries its own customization', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));
    act(() => result.current.toggleOption(walkingBundle.menuDefinition.sections[1], 'soup'));

    let started = true;
    act(() => {
      started = result.current.beginOptionTour(walkingBundle.menuDefinition.sections[1]);
    });
    expect(started).toBe(false);
    expect(result.current.customizingOption).toBeNull();
  });

  it('advances the walk option by option and ends with a done verdict', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));
    act(() => result.current.toggleOption(sidesSection, 'fries'));
    act(() => result.current.toggleOption(sidesSection, 'salad'));
    act(() => result.current.beginOptionTour(sidesSection));

    let outcome: ReturnType<typeof result.current.advanceOptionTour> | undefined;
    act(() => {
      outcome = result.current.advanceOptionTour();
    });
    expect(outcome).toBe('advanced');
    expect(result.current.customizingOption).toEqual({ sectionId: 'sides', itemId: 'salad' });
    expect(result.current.optionTourSectionId).toBe('sides');

    act(() => {
      outcome = result.current.advanceOptionTour();
    });
    expect(outcome).toBe('done');
    expect(result.current.customizingOption).toBeNull();
    expect(result.current.optionTourSectionId).toBeNull();
  });

  it('skips options without their own customization while walking', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));
    act(() => result.current.toggleOption(sidesSection, 'soup'));
    act(() => result.current.toggleOption(sidesSection, 'fries'));
    act(() => result.current.beginOptionTour(sidesSection));

    // Soup sits between fries and nothing — the walk lands on fries and finishes there.
    let outcome: ReturnType<typeof result.current.advanceOptionTour> | undefined;
    act(() => {
      outcome = result.current.advanceOptionTour();
    });
    expect(outcome).toBe('done');
  });

  it('a review visit never walks — Done hands back to the section it was opened from', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));
    act(() => result.current.toggleOption(sidesSection, 'fries'));
    act(() => result.current.openOptionCustomization('sides', 'fries'));

    expect(result.current.optionTourSectionId).toBeNull();
    expect(result.current.advanceOptionTour()).toBe('review');
    expect(result.current.customizingOption).toEqual({ sectionId: 'sides', itemId: 'fries' });
  });

  it('the guided entry opens at the picked option itself', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));

    act(() => result.current.beginOptionTourAt('sides', 'salad'));
    expect(result.current.customizingOption).toEqual({ sectionId: 'sides', itemId: 'salad' });
    expect(result.current.optionTourSectionId).toBe('sides');
  });

  it('dies with the sheet: closing it resets the walk', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(walkingBundle));
    act(() => result.current.beginOptionTourAt('sides', 'fries'));
    act(() => result.current.close());

    expect(result.current.customizingOption).toBeNull();
    expect(result.current.optionTourSectionId).toBeNull();
  });
});
