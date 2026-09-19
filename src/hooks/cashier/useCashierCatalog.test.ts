import { renderHook, waitFor, act } from '@testing-library/react';
import { useCashierCatalog } from './useCashierCatalog';
import { getCategories } from '@/services/categoryService';
import { getProducts } from '@/services/menuService';

jest.mock('@/services/categoryService', () => ({ getCategories: jest.fn() }));
jest.mock('@/services/menuService', () => ({ getProducts: jest.fn() }));

const mockCategories = getCategories as jest.Mock;
const mockProducts = getProducts as jest.Mock;

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Espresso',
  description: 'coffee',
  basePrice: 3.5,
  isActive: true,
  isAvailable: true,
  type: 'Product',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCategories.mockResolvedValue({
    success: true,
    data: {
      items: [
        { id: 'c1', name: 'Drinks', isActive: true },
        { id: 'c2', name: 'Hidden', isActive: false },
      ],
    },
  });
  mockProducts.mockResolvedValue({
    success: true,
    data: { items: [product(), product({ id: 'p2', name: 'Latte', isAvailable: false })] },
  });
});

describe('useCashierCatalog — the guest catalog services, one shelf', () => {
  it('loads active categories and available products from the guest data services', async () => {
    const { result } = renderHook(() => useCashierCatalog());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockCategories).toHaveBeenCalledWith(1, 100);
    expect(mockProducts).toHaveBeenCalledWith(1, 200, null);
    expect(result.current.categories).toEqual([{ id: 'c1', name: 'Drinks' }]);
    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0].id).toBe('p1');
  });

  it('refetches the products of a chosen category', async () => {
    const { result } = renderHook(() => useCashierCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.setSelectedCategoryId('c1');
    });

    expect(mockProducts).toHaveBeenLastCalledWith(1, 200, 'c1');
  });

  it('filters the loaded shelf by name and description on search', async () => {
    mockProducts.mockResolvedValue({
      success: true,
      data: {
        items: [
          product(),
          product({ id: 'p3', name: 'Latte', description: 'milky coffee' }),
          product({ id: 'p4', name: 'Tea', description: 'herbal' }),
        ],
      },
    });
    const { result } = renderHook(() => useCashierCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.setSearchQuery('coffee');
    });

    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('keeps the catalog browsable without categories when the category list fails', async () => {
    mockCategories.mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => useCashierCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.categories).toEqual([]);
    expect(result.current.products).toHaveLength(1);
  });

  it('reports a network failure on the product fetch as an error with a retry', async () => {
    mockProducts.mockRejectedValueOnce(new TypeError('down'));
    const { result } = renderHook(() => useCashierCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('down');
    expect(result.current.products).toHaveLength(0);
  });

  it('reports a server refusal as an error with a retry, instead of an empty shelf', async () => {
    mockProducts.mockResolvedValue({ success: false, message: 'no' });
    const { result } = renderHook(() => useCashierCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('no');
    expect(result.current.products).toHaveLength(0);

    mockProducts.mockResolvedValue({
      success: true,
      data: { items: [product()] },
    });
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.products).toHaveLength(1);
  });
});
