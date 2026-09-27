import { apiClient } from '@/utils/apiClient';
import { isOptionSetReferenceAvailable } from './optionSetReferenceService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

describe('isOptionSetReferenceAvailable', () => {
  it('checks saved ingredients by exact ID and rejects archived or wrong-kind rows', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: { isActive: true, isArchived: false, kind: 'ingredient' },
    });
    await expect(isOptionSetReferenceAvailable('ingredient', 'ingredient-1')).resolves.toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith('/api/global-ingredients/ingredient-1', { requireAuth: true });

    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: { isActive: true, isArchived: true, kind: 'ingredient' },
    });
    await expect(isOptionSetReferenceAvailable('ingredient', 'ingredient-2')).resolves.toBe(false);
  });

  it('checks saved products exactly and excludes internal components only for suggested sides', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: { isActive: true, isAvailable: true, isComponent: true },
    });
    await expect(isOptionSetReferenceAvailable('bundleChoice', 'product-1')).resolves.toBe(true);
    await expect(isOptionSetReferenceAvailable('suggestedSide', 'product-1')).resolves.toBe(false);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/api/Products/product-1', { requireAuth: true });
  });
});
