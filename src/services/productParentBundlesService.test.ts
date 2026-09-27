import { getProductParentBundles } from './productParentBundlesService';
import { apiClient } from '@/utils/apiClient';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

describe('getProductParentBundles', () => {
  it('uses the tenant admin route and forwards request cancellation', async () => {
    const signal = new AbortController().signal;
    const response = { success: true, data: { items: [] } };
    (apiClient.get as jest.Mock).mockResolvedValueOnce(response);

    await expect(getProductParentBundles('item/1', signal)).resolves.toBe(response);

    expect(apiClient.get).toHaveBeenCalledWith('/api/Products/item%2F1/parent-bundles', { signal });
  });
});
