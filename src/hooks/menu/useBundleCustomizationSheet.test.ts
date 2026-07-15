import { renderHook, act } from '@testing-library/react';
import { useBundleCustomizationSheet } from './useBundleCustomizationSheet';
import type { MenuBundleItem } from '@/types/menu';

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

  it('toggles the drill-in disclosure open and closed', () => {
    const { result } = renderHook(() => useBundleCustomizationSheet());
    act(() => result.current.openForBundle(bundle));

    act(() => result.current.toggleOptionExpanded('main', 'burger'));
    expect(result.current.expandedOptionKey).toBe('main::burger');

    act(() => result.current.toggleOptionExpanded('main', 'burger'));
    expect(result.current.expandedOptionKey).toBeNull();
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
});
