import { apiClient } from '@/utils/apiClient';
import { resolveAccountPaymentActorId } from './accountPaymentActorService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const mockGet = apiClient.get as jest.Mock;
const actorId = '3b241101-e2bb-4255-8caf-4136c566a962';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveAccountPaymentActorId', () => {
  it('requests the profile without signing out and returns only its canonical ID', async () => {
    mockGet.mockResolvedValue({ success: true, data: { id: actorId.toUpperCase(), email: 'private@example.com' } });

    await expect(resolveAccountPaymentActorId()).resolves.toBe(actorId);
    expect(mockGet).toHaveBeenCalledWith('/api/User/profile', {
      requireAuth: true,
      signOutOn401: false,
    });
  });

  it.each([
    ['unsuccessful envelope', { success: false, data: { id: actorId } }],
    ['missing envelope', { data: { id: actorId } }],
    ['missing profile data', { success: true }],
    ['non-object profile data', { success: true, data: actorId }],
    ['email instead of an ID', { success: true, data: { id: 'cashier@example.com' } }],
    ['empty UUID', { success: true, data: { id: '00000000-0000-0000-0000-000000000000' } }],
  ])('rejects %s without exposing profile data', async (_label, response) => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGet.mockResolvedValue(response);

    await expect(resolveAccountPaymentActorId()).resolves.toBeUndefined();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });

  it('propagates lookup failures without logging or inspecting private error details', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGet.mockRejectedValue(new Error('private response details'));

    await expect(resolveAccountPaymentActorId()).rejects.toThrow('private response details');
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });
});
