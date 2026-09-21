import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { getCategories } from '@/services/categoryService';
import { getProducts } from '@/services/menuService';
import { useServerTakeawayCatalog } from './useServerTakeawayCatalog';

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
  availability: { canOrder: true, reason: 'Available', allowedOrderTypes: [OrderType.Takeaway] },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCategories.mockResolvedValue({ success: true, data: { items: [] } });
  mockProducts.mockResolvedValue({
    success: true,
    data: { items: [product('tea')], totalCount: 1, totalPages: 1 },
  });
});

describe('useServerTakeawayCatalog', () => {
  it('requests takeaway availability and excludes a channel-blocked product', async () => {
    mockProducts.mockResolvedValue({
      success: true,
      data: {
        items: [
          product('tea'),
          product('dine-in-only', {
            availability: { canOrder: false, reason: 'WrongOrderType', allowedOrderTypes: [OrderType.DineIn] },
          }),
        ],
        totalCount: 2,
        totalPages: 1,
      },
    });

    const { result } = renderHook(() => useServerTakeawayCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockProducts).toHaveBeenCalledWith(1, 100, null, undefined, OrderType.Takeaway);
    expect(result.current.products.map((entry) => entry.id)).toEqual(['tea']);
  });

  it('loads every reported page before applying local search', async () => {
    mockProducts
      .mockResolvedValueOnce({
        success: true,
        data: { items: [product('tea')], totalCount: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { items: [product('coffee')], totalCount: 2, totalPages: 2 },
      });

    const { result } = renderHook(() => useServerTakeawayCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setSearchQuery('coffee'));

    expect(mockProducts).toHaveBeenCalledTimes(2);
    expect(result.current.products.map((entry) => entry.id)).toEqual(['coffee']);
  });
});
