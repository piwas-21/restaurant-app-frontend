/**
 * `getMyAddresses` is one of the four log-suppression guards #401 changed, and the only one whose
 * file had no test at all.
 *
 * The guard used to ask whether the error MESSAGE contained 'auth' — which worked only because
 * `apiClient` wrote 'Authentication required' itself. It no longer does, so a message test would
 * now be false for exactly the case it exists to suppress: a guest at checkout, who has no token,
 * so the request is refused pre-flight. Getting that wrong is not user-visible; it just fills
 * every guest's console with an error that is expected.
 */

import { apiClient, ApiError } from '@/utils/apiClient';
import { getMyAddresses } from './addressService';

// Stub the HTTP surface, keep `ApiError` and `isAuthError` real — an automock turns the predicate
// into a `jest.fn()` returning `undefined` and inverts the guard under test.
jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getMyAddresses', () => {
  it('returns the addresses', async () => {
    mockGet.mockResolvedValue({ success: true, data: [{ id: 'a1', city: 'Genève' }] });

    await expect(getMyAddresses()).resolves.toEqual([{ id: 'a1', city: 'Genève' }]);
    expect(mockGet).toHaveBeenCalledWith('/api/Addresses', { requireAuth: true });
  });

  it('throws when the payload carries no data', async () => {
    mockGet.mockResolvedValue({ success: true });

    await expect(getMyAddresses()).rejects.toThrow('Failed to fetch addresses');
  });

  it('stays quiet for the unauthenticated guest, and logs anything else', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockGet.mockRejectedValueOnce(new ApiError(401, ''));
      await expect(getMyAddresses()).rejects.toBeInstanceOf(ApiError);
      expect(consoleError).not.toHaveBeenCalled();

      mockGet.mockRejectedValueOnce(new ApiError(500, ''));
      await expect(getMyAddresses()).rejects.toBeInstanceOf(ApiError);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
