import { apiClient, ApiError } from '@/utils/apiClient';
import { fidelityPointsService } from '@/services/fidelityPointsService';

// Stub the HTTP surface, keep everything else REAL. A factory that stubs `apiClient` alone left
// `isAuthError` UNDEFINED, so the service's catch threw "(0, _apiClient.isAuthError) is not a
// function" instead of the API error — and the `rejects.toThrow()` below passed on that, because a
// bare `toThrow()` accepts any throw. Spreading `requireActual` rather than hand-picking the two
// exports needed today is the point: hand-picking is what created that hole, and it re-creates it
// the day the service reaches for `getErrorMessage`.
jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('fidelityPointsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return user balance', async () => {
      const mockBalance = {
        userId: '123',
        currentPoints: 500,
        totalEarnedPoints: 1000,
        totalRedeemedPoints: 500,
        lastUpdated: new Date().toISOString(),
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockBalance });

      const result = await fidelityPointsService.getBalance();

      expect(apiClient.get).toHaveBeenCalledWith('/api/FidelityPoints/balance', { requireAuth: true });
      expect(result).toEqual(mockBalance);
    });

    // Named, not a bare `toThrow()`: the assertion has to fail when the catch throws something of
    // its OWN, which is how a missing mock export hid here for as long as it did.
    it('rethrows the failure it was given', async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(fidelityPointsService.getBalance()).rejects.toThrow('API Error');
    });

    // A guest reaching checkout has no token, so `apiClient` refuses before it asks the server.
    // That is expected, not an incident, and it must not fill the console — the guard is on the
    // 401 STATUS, because since #401 there is no 'Authentication required' message to match on.
    it('stays quiet for the unauthenticated guest, and logs anything else', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        (apiClient.get as jest.Mock).mockRejectedValueOnce(new ApiError(401, ''));
        await expect(fidelityPointsService.getBalance()).rejects.toBeInstanceOf(ApiError);
        expect(consoleError).not.toHaveBeenCalled();

        (apiClient.get as jest.Mock).mockRejectedValueOnce(new ApiError(500, ''));
        await expect(fidelityPointsService.getBalance()).rejects.toBeInstanceOf(ApiError);
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('getHistory', () => {
    it('should return paginated transaction history', async () => {
      const mockHistory = {
        items: [
          {
            id: '1',
            userId: '123',
            transactionType: 'Earned',
            points: 100,
            description: 'Order #1',
            createdAt: new Date().toISOString(),
          },
        ],
        pageNumber: 1,
        pageSize: 20,
        totalCount: 1,
        hasNextPage: false,
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockHistory.items });

      const result = await fidelityPointsService.getHistory({ page: 1, pageSize: 20 });

      expect(apiClient.get).toHaveBeenCalled();
      expect(result).toEqual(mockHistory.items);
    });
  });

  describe('calculateDiscount', () => {
    // Same guard as `getBalance`, same reason, and the second of the four sites #401 changed.
    it('stays quiet for the unauthenticated guest, and logs anything else', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        (apiClient.get as jest.Mock).mockRejectedValueOnce(new ApiError(401, ''));
        await expect(fidelityPointsService.calculateDiscount(100)).rejects.toBeInstanceOf(ApiError);
        expect(consoleError).not.toHaveBeenCalled();

        (apiClient.get as jest.Mock).mockRejectedValueOnce(new ApiError(500, ''));
        await expect(fidelityPointsService.calculateDiscount(100)).rejects.toBeInstanceOf(ApiError);
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        consoleError.mockRestore();
      }
    });

    it('should calculate discount from points', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: 5.0 });

      const result = await fidelityPointsService.calculateDiscount(500);

      expect(apiClient.get).toHaveBeenCalled();
      expect(result).toBe(5.0);
    });
  });

  describe('calculatePoints', () => {
    it('should calculate points needed for discount', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: 500 });

      const result = await fidelityPointsService.calculatePoints(5.0);

      expect(apiClient.get).toHaveBeenCalled();
      expect(result).toBe(500);
    });
  });

  describe('formatPointsAsCurrency', () => {
    it('should format points as currency', () => {
      expect(fidelityPointsService.formatPointsAsCurrency(100)).toContain('1.00');
      expect(fidelityPointsService.formatPointsAsCurrency(500)).toContain('5.00');
      expect(fidelityPointsService.formatPointsAsCurrency(1000)).toContain('10.00');
    });
  });

  describe('getTransactionTypeLabel', () => {
    it('should return correct labels for transaction types', () => {
      expect(fidelityPointsService.getTransactionTypeLabel('Earned')).toBe('Points Earned');
      expect(fidelityPointsService.getTransactionTypeLabel('Redeemed')).toBe('Points Redeemed');
      expect(fidelityPointsService.getTransactionTypeLabel('AdminAdjustment')).toBe('Admin Adjustment');
      expect(fidelityPointsService.getTransactionTypeLabel('Expired')).toBe('Points Expired');
      expect(fidelityPointsService.getTransactionTypeLabel('Unknown')).toBe('Unknown');
    });
  });

  describe('getTransactionTypeColor', () => {
    it('should return correct colors for transaction types', () => {
      expect(fidelityPointsService.getTransactionTypeColor('Earned')).toBe('text-green-600');
      expect(fidelityPointsService.getTransactionTypeColor('Redeemed')).toBe('text-blue-600');
      expect(fidelityPointsService.getTransactionTypeColor('AdminAdjustment')).toBe('text-purple-600');
      expect(fidelityPointsService.getTransactionTypeColor('Expired')).toBe('text-gray-600');
      expect(fidelityPointsService.getTransactionTypeColor('Unknown')).toBe('text-gray-600');
    });
  });
});
