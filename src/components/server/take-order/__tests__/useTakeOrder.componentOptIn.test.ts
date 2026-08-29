import { act, renderHook, waitFor } from '@testing-library/react';
import { useTakeOrder } from '../useTakeOrder';
import { getProducts } from '@/services/menuService';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('useTakeOrder never asks for option-only items', () => {
  it('sends no product-type query, so the server keeps components out of the waiter list', async () => {
    renderHook(() => useTakeOrder({ tableNumber: '12', onClose: jest.fn(), onOrderCreated: jest.fn() }));

    await waitFor(() => expect(mockGetProducts).toHaveBeenCalled());
    expect(mockGetProducts.mock.calls[0][3]).toBeUndefined();
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
    expect(mockGetProducts.mock.calls[last][3]).toBeUndefined();
  });
});
