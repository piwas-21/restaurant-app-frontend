import { apiClient, ApiError } from '@/utils/apiClient';
import { tableGuestVisitService, isExpiredVisitError, isUnavailableVisitError } from './tableGuestVisitService';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

describe('tableGuestVisitService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('joins with the QR payload and admission code without putting identity in the URL', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: { serviceSessionId: 'visit-id', participantToken: 'secret-token', expiresAt: '2030-01-01T00:00:00Z' },
    });

    await tableGuestVisitService.joinTableGuestVisit('qr-data', 'GH23456789');

    expect(apiClient.post).toHaveBeenCalledWith('/api/table-guest-visits/join', {
      qrCodeData: 'qr-data',
      admissionCode: 'GH23456789',
    });
    expect(window.location.href).not.toContain('secret-token');
  });

  it('sends the visit credential and expected digest with a required basket session', async () => {
    const identity = {
      serviceSessionId: 'visit-id',
      participantToken: 'secret-token',
      expiresAt: '2030-01-01T00:00:00Z',
    };
    const request = {
      operationId: 'operation-id',
      expectedAccountRevision: 3,
      expectedBasketFingerprint: 'A'.repeat(64),
    };
    jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: { accountRevision: 4 } });

    await tableGuestVisitService.createTableGuestRound(identity, request);

    expect(apiClient.post).toHaveBeenCalledWith('/api/table-guest-visits/visit-id/rounds', request, {
      headers: { 'X-Table-Participant': 'secret-token' },
      requireSession: true,
    });
  });

  it('recognizes unavailable visits from the stable transport status', () => {
    expect(isUnavailableVisitError(new ApiError(410, ''))).toBe(true);
    expect(isUnavailableVisitError(new ApiError(404, ''))).toBe(true);
    expect(isExpiredVisitError(new ApiError(404, ''))).toBe(false);
    expect(isExpiredVisitError(new ApiError(410, ''))).toBe(true);
    expect(isUnavailableVisitError(new ApiError(500, ''))).toBe(false);
  });
});
