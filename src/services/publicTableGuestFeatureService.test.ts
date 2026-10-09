import { apiClient } from '@/utils/apiClient';
import { getPublicTableGuestFeature } from './publicTableGuestFeatureService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

describe('getPublicTableGuestFeature', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the anonymous tenant flag from the additive public endpoint', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: { tableGuestVisitsV1: true, tableAccountPaymentsV1: true, tableGuestAccountPaymentsV1: true },
    });

    await expect(getPublicTableGuestFeature()).resolves.toEqual({
      available: true,
      enabled: true,
      tableAccountPaymentsV1: true,
      tableGuestAccountPaymentsV1: true,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/tenant/features', { signOutOn401: false });
  });

  it.each([
    { success: true, data: { tableGuestVisitsV1: false } },
    { success: true, data: {} },
  ])('treats an old or disabled response as closed (%o)', async (response) => {
    jest.mocked(apiClient.get).mockResolvedValue(response);
    await expect(getPublicTableGuestFeature()).resolves.toEqual({
      available: true,
      enabled: false,
      tableAccountPaymentsV1: null,
      tableGuestAccountPaymentsV1: null,
    });
  });

  it('keeps missing additive account flags unknown instead of treating them as disabled', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: { tableGuestVisitsV1: true, tableAccountPaymentsV1: true },
    });
    await expect(getPublicTableGuestFeature()).resolves.toMatchObject({
      available: true,
      enabled: true,
      tableAccountPaymentsV1: true,
      tableGuestAccountPaymentsV1: null,
    });
  });

  it.each(['true', 1, null])('keeps a malformed guest payment flag unknown (%o)', async (flag) => {
    jest.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: { tableGuestVisitsV1: true, tableAccountPaymentsV1: flag, tableGuestAccountPaymentsV1: true },
    });
    await expect(getPublicTableGuestFeature()).resolves.toMatchObject({
      available: true,
      enabled: true,
      tableAccountPaymentsV1: null,
      tableGuestAccountPaymentsV1: true,
    });
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
