import { act, renderHook, waitFor } from '@testing-library/react';
import { parseServerTableNumber, useTakeOrder } from '../useTakeOrder';
import { getProducts } from '@/services/menuService';
import { createServerOrder } from '@/services/serverService';
import type { Product } from '@/services/server/menu';
import type { CustomizationResult } from '@/components/catalog/ProductCustomization';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

/**
 * The WAITER's take-order screen and the option-only opt-in (frontend #631).
 *
 * A waiter builds a real order from this list, so it must contain exactly what a guest could be
 * served on its own. `GET /api/Products` already excludes `isComponent` rows from any caller that
 * does not ask — so what protects this screen is the ABSENCE of a parameter, which is the kind of
 * thing a copy-paste from the admin catalog adds without anything looking wrong afterwards.
 *
 * A component priced at 0 (one of six meats inside a bundle) would appear here as a free dish.
 */
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));
jest.mock('@/services/serverService', () => ({
  getCategories: jest.fn(async () => []),
  createServerOrder: jest.fn(),
  calculateDiscountFromPoints: jest.fn(() => 0),
}));

const mockGetProducts = getProducts as jest.Mock;
const mockCreateServerOrder = createServerOrder as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('useTakeOrder asks for menu parents but never option-only components', () => {
  it.each(['T-QA', '12A', ''])('rejects unsupported table label %s before numeric submission', (label) => {
    expect(parseServerTableNumber(label)).toBeNull();
  });

  it('accepts only a positive integer table label', () => {
    expect(parseServerTableNumber(' 12 ')).toBe(12);
    expect(parseServerTableNumber('0')).toBeNull();
  });

  it('does not submit an alphanumeric table label as a parsed numeric table', async () => {
    const { result } = renderHook(() =>
      useTakeOrder({ tableNumber: 'T-QA', onClose: jest.fn(), onOrderCreated: jest.fn() }),
    );
    const product = {
      id: 'product-1',
      name: 'Test item',
      description: '',
      basePrice: 5,
      isActive: true,
      isAvailable: true,
      type: 'Food',
    } as Product;
    const customization = {
      productId: product.id,
      addedIngredients: [],
      removedIngredients: [],
      selectedIngredientIds: [],
      ingredientQuantities: {},
      sideItems: [],
      finalPrice: product.basePrice,
    } as CustomizationResult;

    act(() => result.current.setSelectedProductForCustomization(product));
    act(() => result.current.handleCustomizationConfirm(customization));
    await act(async () => result.current.handleSubmit());

    expect(mockCreateServerOrder).not.toHaveBeenCalled();
    expect(result.current.error).toBe('This table label cannot be used for waiter orders yet.');
  });

  it('asks for menu parents without exposing components as standalone dishes', async () => {
    renderHook(() => useTakeOrder({ tableNumber: '12', onClose: jest.fn(), onOrderCreated: jest.fn() }));

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(mockGetProducts.mock.calls[0][3]).toEqual({ includeMenus: true });
    expect(mockGetProducts.mock.calls[0][3]).not.toHaveProperty('includeComponents');
  });

  it('still sends none after a category is chosen', async () => {
    const { result } = renderHook(() =>
      useTakeOrder({ tableNumber: '12', onClose: jest.fn(), onOrderCreated: jest.fn() }),
    );
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());

    await act(async () => result.current.setSelectedCategory('cat-1'));

    await waitFor(() => expect(mockGetProducts.mock.calls.length).toBeGreaterThan(1));
    const last = mockGetProducts.mock.calls.length - 1;
    expect(mockGetProducts.mock.calls[last][2]).toBe('cat-1');
    expect(mockGetProducts.mock.calls[last][3]).toEqual({ includeMenus: true });
    expect(mockGetProducts.mock.calls[last][3]).not.toHaveProperty('includeComponents');
  });
});
