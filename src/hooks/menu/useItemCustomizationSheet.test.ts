import { renderHook, act, waitFor } from '@testing-library/react';
import { useItemCustomizationSheet } from './useItemCustomizationSheet';
import { getProductById } from '@/services/menuService';

const mockAddItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: mockAddItem }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f || _k, i18n: { language: 'en' } }),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));

const mockGetProductById = getProductById as jest.Mock;

const productWithOptions = {
  id: 'p1',
  name: 'Pizza',
  content: { en: { name: 'Pizza' } },
  basePrice: 10,
  variations: [],
  suggestedSideItems: [{ id: 'fries', name: 'Fries', price: 4, isRequired: true, displayOrder: 1 }],
  detailedIngredients: [
    {
      id: 'cheese',
      name: 'Cheese',
      price: 2,
      isOptional: true,
      isActive: true,
      isIncludedInBasePrice: true,
      maxQuantity: 3,
      displayOrder: 1,
    },
    {
      id: 'bacon',
      name: 'Bacon',
      price: 3,
      isOptional: true,
      isActive: true,
      isIncludedInBasePrice: false,
      maxQuantity: 2,
      displayOrder: 2,
    },
  ],
};

beforeEach(() => {
  mockAddItem.mockClear();
  mockGetProductById.mockReset();
});

describe('useItemCustomizationSheet', () => {
  it('opens the sheet with the base-recipe default selection and adds the customized line', async () => {
    mockGetProductById.mockResolvedValue({ data: productWithOptions });
    const { result } = renderHook(() => useItemCustomizationSheet());

    await act(async () => {
      await result.current.openForProduct('p1');
    });

    await waitFor(() => expect(result.current.isOpen).toBe(true));
    // base recipe: the included 'cheese' is preselected, the paid add-on 'bacon' is not; required side preselected.
    expect(result.current.selectedIngredients).toEqual(['cheese']);
    expect(result.current.selectedSideItems).toEqual([{ id: 'fries', quantity: 1 }]);
    // default line prices at base + required side (10 + 4).
    expect(result.current.linePrice.total).toBe(14);

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p1',
        quantity: 1,
        selectedIngredients: ['cheese'],
        selectedSideItems: [{ id: 'fries', quantity: 1 }],
      }),
    );
    expect(result.current.isOpen).toBe(false);
  });

  // The product half of the #150 removal convention. `OptionalIngredientsSection` is shared with
  // the bundle drill-in, and the regular-item backend branch persists the client quantity map
  // verbatim — so a deselection must reach the payload as an explicit 0, or the kitchen ticket
  // never learns the ingredient was removed.
  it('deducts a removed included-in-base ingredient and sends the removal as quantity 0', async () => {
    mockGetProductById.mockResolvedValue({ data: productWithOptions });
    const { result } = renderHook(() => useItemCustomizationSheet());

    await act(async () => {
      await result.current.openForProduct('p1');
    });
    await waitFor(() => expect(result.current.isOpen).toBe(true));

    // Drop the cheese that comes free in the base: −2 off the 14 the default line prices at.
    act(() => {
      result.current.setSelectedIngredients([]);
      result.current.setIngredientQuantities((prev) => ({ ...prev, cheese: 0 }));
    });

    expect(result.current.linePrice.total).toBe(12);

    await act(async () => {
      await result.current.addToCart();
    });

    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ selectedIngredients: [], ingredientQuantities: { cheese: 0 } }),
    );
  });

  // A bundle IS a product with type 'menu', so an entry point holding only an id (the featured
  // special) can land on one. The retired ProductDetailsModal handled this by rendering a second
  // modal from inside itself and adding via addItemToBasket — bypassing CartContext entirely.
  it('routes a product id that turns out to be a combo to the bundle sheet, and never opens itself', async () => {
    const onBundleDetected = jest.fn();
    mockGetProductById.mockResolvedValue({
      data: {
        id: 'combo',
        name: 'Lunch Combo',
        type: 'menu',
        basePrice: 20,
        content: { en: { name: 'Lunch Combo' } },
        variations: [],
        suggestedSideItems: [],
        detailedIngredients: [],
        images: [],
        categories: [],
        allergens: [],
        ingredients: [],
        isActive: true,
        isAvailable: true,
        isSpecial: false,
        displayOrder: 1,
        menuDefinition: { id: 'md1', sections: [] },
      },
    });
    const { result } = renderHook(() => useItemCustomizationSheet({ onBundleDetected }));

    await act(async () => {
      await result.current.openForProduct('combo');
    });

    expect(onBundleDetected).toHaveBeenCalledWith(expect.objectContaining({ id: 'combo', basePrice: 20 }));
    expect(result.current.isOpen).toBe(false);
    // Critically: it must not fall through to the no-options branch and silently add the combo
    // with none of its sections chosen.
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it('adds a no-options product straight to the cart without opening the sheet', async () => {
    mockGetProductById.mockResolvedValue({
      data: {
        id: 'p2',
        name: 'Water',
        content: { en: { name: 'Water' } },
        basePrice: 2,
        variations: [],
        suggestedSideItems: [],
        detailedIngredients: [],
      },
    });
    const { result } = renderHook(() => useItemCustomizationSheet());

    await act(async () => {
      await result.current.openForProduct('p2');
    });

    expect(result.current.isOpen).toBe(false);
    expect(mockAddItem).toHaveBeenCalledWith({ productId: 'p2', quantity: 1 });
  });
});
