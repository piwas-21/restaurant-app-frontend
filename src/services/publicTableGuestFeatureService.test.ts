import { apiClient } from '@/utils/apiClient';
import { getPublicTableGuestFeature } from './publicTableGuestFeatureService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

describe('getPublicTableGuestFeature', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the anonymous tenant flag from the additive public endpoint', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { tableGuestVisitsV1: true } });

    await expect(getPublicTableGuestFeature()).resolves.toEqual({ available: true, enabled: true });
    expect(apiClient.get).toHaveBeenCalledWith('/api/tenant/features', { signOutOn401: false });
  });

  it.each([
    { success: true, data: { tableGuestVisitsV1: false } },
    { success: true, data: {} },
  ])('treats an old or disabled response as closed (%o)', async (response) => {
    jest.mocked(apiClient.get).mockResolvedValue(response);
    await expect(getPublicTableGuestFeature()).resolves.toEqual({ available: true, enabled: false });
  });

  it('treats a malformed endpoint response as unavailable', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: false, data: { tableGuestVisitsV1: true } });
    await expect(getPublicTableGuestFeature()).resolves.toEqual({ available: false, enabled: false });
  });

  it('fails closed when the endpoint is unavailable', async () => {
    jest.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
    await expect(getPublicTableGuestFeature()).resolves.toEqual({ available: false, enabled: false });
  });
});
