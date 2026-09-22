import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { getCategories } from '@/services/categoryService';
import { getProducts } from '@/services/menuService';
import { useServerTableRoundCatalog } from './useServerTableRoundCatalog';

jest.mock('@/services/categoryService', () => ({ getCategories: jest.fn() }));
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));

const mockCategories = getCategories as jest.Mock;
const mockProducts = getProducts as jest.Mock;
const product = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  basePrice: 5,
  isActive: true,
  isAvailable: true,
  type: 'mainItem',
  availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.DineIn] },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockCategories.mockResolvedValue({ success: true, data: { items: [] } });
  mockProducts.mockResolvedValue({
    success: true,
    data: { items: [product('tea'), product('menu', { type: 'menu' })], totalCount: 2, totalPages: 1 },
  });
});

it('persists staff-scoped favorites and exposes the favorite shelf', async () => {
  const { result } = renderHook(() => useServerTableRoundCatalog('server@example.com'));
  await waitFor(() => expect(result.current.isLoading).toBe(false));

  act(() => result.current.toggleFavorite('tea'));
  act(() => result.current.setShowFavorites(true));

  expect(result.current.products.map((entry) => entry.id)).toEqual(['tea']);
  expect(window.localStorage.getItem('server.table-round-favorites')).toContain('server@example.com');
});

it('loads every Dine-in page with menu parents and retains blocked rows for an explained disabled state', async () => {
  mockProducts
    .mockResolvedValueOnce({
      success: true,
      data: { items: [product('tea')], totalCount: 3, totalPages: 2 },
    })
    .mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          product('menu', { type: 'menu' }),
          product('blocked', { availability: { canOrder: false, reason: 'WrongOrderType' } }),
        ],
        totalCount: 3,
        totalPages: 2,
      },
    });

  const { result } = renderHook(() => useServerTableRoundCatalog());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => result.current.setSearchQuery('menu'));

  expect(mockProducts).toHaveBeenNthCalledWith(1, 1, 100, null, { includeMenus: true }, OrderType.DineIn);
  expect(mockProducts).toHaveBeenNthCalledWith(2, 2, 100, null, { includeMenus: true }, OrderType.DineIn);
  expect(result.current.products.map((entry) => entry.id)).toEqual(['menu']);
  act(() => result.current.setSearchQuery('blocked'));
  expect(result.current.products.map((entry) => entry.id)).toEqual(['blocked']);
});

it('fails explicitly instead of presenting a truncated catalogue', async () => {
  mockProducts.mockResolvedValue({
    success: true,
    data: { items: [product('tea')], totalCount: 1100, totalPages: 11 },
  });
  const { result } = renderHook(() => useServerTableRoundCatalog());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBe('server.round.catalog_error');
  expect(result.current.products).toEqual([]);
});
