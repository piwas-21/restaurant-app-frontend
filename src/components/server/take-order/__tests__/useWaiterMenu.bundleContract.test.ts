import { act, renderHook } from '@testing-library/react';
import { useWaiterMenu } from '../useWaiterMenu';
import { getProductById, getProducts } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import type { Product } from '@/services/serverService';
import type { MenuBundleItem, MenuSectionItem } from '@/types/menu';

/**
 * The waiter opens a menu from the BUNDLE contract, never from the product read.
 *
 * `GET /api/Products/{id}` projects a menu's option rows down to id/name/price
 * (`MenuSectionItemDto`); `GET /api/Menus/{id}` carries each option's `detailedIngredients` and sauce
 * rule (`MenuBundleSectionItemDto`, backend #468). The guest grid reads the second. The waiter used to
 * read the first, so a fixed Plat opened with nothing to customize and its child row reached the
 * server without the recipe the guest's carries — one menu, two payloads.
 */
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn(), getProductById: jest.fn() }));
jest.mock('@/services/menuBundleService', () => ({ getMenuBundleById: jest.fn() }));
jest.mock('@/services/serverService', () => ({ getCategories: jest.fn(async () => []) }));

const mockGetProducts = getProducts as jest.Mock;
const mockGetProductById = getProductById as jest.Mock;
const mockGetMenuBundleById = getMenuBundleById as jest.Mock;

const platRow: MenuSectionItem = {
  id: 'row',
  productId: 'sandwich',
  productName: 'Sandwich Kebab',
  additionalPrice: 0,
  displayOrder: 0,
  isDefault: true,
  sauceMin: 0,
  sauceMax: 3,
  sauceIncludedFree: 3,
  detailedIngredients: [
    {
      id: 'salade',
      name: 'Salade',
      isActive: true,
      isOptional: true,
      isIncludedInBasePrice: true,
      price: 0,
      maxQuantity: 1,
      displayOrder: 0,
    },
    {
      id: 'mayo',
      name: 'Mayonnaise',
      isActive: true,
      isOptional: true,
      isIncludedInBasePrice: false,
      price: 0,
      maxQuantity: 1,
      displayOrder: 1,
      kind: 'sauce',
    },
  ],
};

const days = {
  isAlwaysAvailable: true,
  availableMonday: true,
  availableTuesday: true,
  availableWednesday: true,
  availableThursday: true,
  availableFriday: true,
  availableSaturday: true,
  availableSunday: true,
};

const bundle: MenuBundleItem = {
  id: 'menu',
  name: 'Menu Sandwich Kebab',
  basePrice: 11,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 0,
  menuDefinition: {
    id: 'def',
    ...days,
    sections: [
      {
        id: 'plat',
        name: 'Plat',
        displayOrder: 0,
        isRequired: true,
        minSelection: 1,
        maxSelection: 1,
        items: [platRow],
      },
    ],
  },
};

/** The product read, as the backend really projects a menu: the same row, stripped of its recipe. */
const productRead = {
  success: true,
  data: {
    ...bundle,
    type: 'menu',
    menuDefinition: {
      ...bundle.menuDefinition,
      sections: [
        {
          ...bundle.menuDefinition.sections[0],
          items: [
            {
              id: platRow.id,
              productId: platRow.productId,
              productName: platRow.productName,
              additionalPrice: 0,
              displayOrder: 0,
              isDefault: true,
            },
          ],
        },
      ],
    },
  },
};

const menuParent = {
  id: 'menu',
  name: 'Menu Sandwich Kebab',
  basePrice: 11,
  isActive: true,
  isAvailable: true,
  type: 'menu',
} as Product;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue({ success: true, data: { items: [] } });
  mockGetProductById.mockResolvedValue(productRead);
  mockGetMenuBundleById.mockResolvedValue({ success: true, data: bundle });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('useWaiterMenu opens a menu from the bundle contract', () => {
  it('hands the sheet a fixed Plat that still carries its recipe and sauce rule', async () => {
    const { result } = renderHook(() => useWaiterMenu());

    await act(async () => {
      await result.current.handleProductClick(menuParent);
    });

    const opened = result.current.selectedBundleForCustomization;
    const item = opened?.menuDefinition.sections[0].items[0];
    expect(item?.detailedIngredients?.map((row) => row.id)).toEqual(['salade', 'mayo']);
    expect(item?.sauceMax).toBe(3);
    expect(mockGetMenuBundleById).toHaveBeenCalledWith('menu');
    // The control. The product read was READY TO ANSWER — with a Plat that has no recipe at all —
    // and a sheet fed from it renders nothing to customize while every other assertion here passes.
    expect(mockGetProductById).not.toHaveBeenCalled();
  });

  it('reports a bundle the contract cannot supply rather than opening an empty sheet', async () => {
    mockGetMenuBundleById.mockResolvedValue({ success: false, data: null });
    const { result } = renderHook(() => useWaiterMenu());

    await act(async () => {
      await result.current.handleProductClick(menuParent);
    });

    expect(result.current.selectedBundleForCustomization).toBeNull();
    expect(result.current.error).toBe('Failed to load menu bundle');
  });

  it('never asks the bundle contract for a plain product', async () => {
    const { result } = renderHook(() => useWaiterMenu());

    await act(async () => {
      await result.current.handleProductClick({ ...menuParent, id: 'dish', type: 'main' } as Product);
    });

    expect(result.current.selectedProductForCustomization?.id).toBe('dish');
    expect(mockGetMenuBundleById).not.toHaveBeenCalled();
  });
});
