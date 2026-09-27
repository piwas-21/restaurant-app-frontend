import { apiClient } from '@/utils/apiClient';
import { getOptionSetTargetProduct } from './optionSetTargetService';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient') as typeof import('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn() } };
});

const target = {
  id: 'product-1',
  name: 'Grilled wrap',
  type: 'MainItem',
  isActive: true,
  isAvailable: true,
} as ProductDetails;

describe('optionSetTargetService', () => {
  it('loads exact tenant product detail through the authenticated same-origin API', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: target });
    await expect(getOptionSetTargetProduct('product-1')).resolves.toBe(target);
    expect(apiClient.get).toHaveBeenCalledWith('/api/Products/product-1', { requireAuth: true });
  });

  it('preserves the server refusal on an unsuccessful detail response', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: false,
      message: 'The target is unavailable',
      errorCode: 'ProductUnavailable',
    });
    await expect(getOptionSetTargetProduct('product-1')).rejects.toMatchObject({
      message: 'The target is unavailable',
      errorCode: 'ProductUnavailable',
    });
  });
});
