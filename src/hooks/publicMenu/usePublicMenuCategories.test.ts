import { renderHook, waitFor } from '@testing-library/react';
import { getCategories } from '@/services/categoryService';
import { usePublicMenuCategories } from './usePublicMenuCategories';

jest.mock('@/services/categoryService', () => ({ getCategories: jest.fn() }));

const mockGetCategories = getCategories as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('usePublicMenuCategories server snapshot recovery', () => {
  it('retries an incomplete server snapshot and publishes the verified client collection', async () => {
    const category = { id: 'category-1', name: 'Soups', isActive: true };
    mockGetCategories.mockResolvedValueOnce({
      success: true,
      data: { items: [category], page: 1, pageSize: 100, totalPages: 1, totalCount: 1 },
    });

    const { result } = renderHook(() => usePublicMenuCategories([], false));

    await waitFor(() => expect(result.current).toEqual([category]));
    expect(mockGetCategories).toHaveBeenCalledWith(1, 100);
  });

  it('does not refetch a verified empty server collection', () => {
    const { result } = renderHook(() => usePublicMenuCategories([], true));

    expect(result.current).toEqual([]);
    expect(mockGetCategories).not.toHaveBeenCalled();
  });
});
