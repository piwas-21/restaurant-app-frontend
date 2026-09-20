import { apiClient } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import { resolvePublicConfirmationFlow } from './orderTypeConfigurationService';

jest.mock('@/utils/apiClient', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('resolvePublicConfirmationFlow', () => {
  it('resolves acknowledge from an on-demand authoritative read', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ orderType: OrderType.Takeaway, confirmationFlow: 'acknowledge', reviewWindowMinutes: 2 }],
    });

    await expect(resolvePublicConfirmationFlow(OrderType.Takeaway)).resolves.toBe('acknowledge');
  });

  it('keeps direct as the compatibility default for an untouched or unavailable type', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    await expect(resolvePublicConfirmationFlow(OrderType.Delivery)).resolves.toBe('direct');

    mockGet.mockRejectedValueOnce(new Error('network'));
    await expect(resolvePublicConfirmationFlow(OrderType.Delivery)).resolves.toBe('direct');
  });
});
