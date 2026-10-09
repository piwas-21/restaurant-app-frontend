import { apiClient } from '@/utils/apiClient';
import { createTableGuestAdmissionCode } from './tableGuestAdmissionCodeService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { post: jest.fn() } }));

describe('createTableGuestAdmissionCode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to the exact visit route using staff authentication', async () => {
    const result = { admissionCode: 'CODE123456', expiresAt: '2026-10-03T12:00:00Z' };
    jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: result });

    await expect(createTableGuestAdmissionCode('session-7')).resolves.toEqual(result);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/table-guest-visits/session-7/admission-code',
      {},
      { requireAuth: true },
    );
  });

  it('requests the short-code format only when a caller explicitly opts in', async () => {
    const result = { admissionCode: 'ABC123', expiresAt: '2026-10-03T12:00:00Z' };
    jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: result });

    await expect(createTableGuestAdmissionCode('session-7', { preferShortCode: true })).resolves.toEqual(result);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/table-guest-visits/session-7/admission-code?preferShortCode=true',
      {},
      { requireAuth: true },
    );
  });

  it('refuses an absent service-session identity before any request', async () => {
    await expect(createTableGuestAdmissionCode('   ')).rejects.toThrow();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
