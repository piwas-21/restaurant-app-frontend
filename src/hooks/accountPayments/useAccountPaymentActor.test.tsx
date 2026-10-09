import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccountPaymentActor } from './useAccountPaymentActor';

const mockApiGet = jest.fn();
const mockUseOptionalAuth = jest.fn();

jest.mock('@/services/accountPaymentActorService', () => ({
  ...jest.requireActual('@/services/accountPaymentActorService'),
  resolveAccountPaymentActorId: (...args: unknown[]) => mockApiGet(...args),
}));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => mockUseOptionalAuth() }));

const actorId = '3b241101-e2bb-4255-8caf-4136c566a962';
const otherActorId = '9f8b7c6d-5e4f-4321-9876-0123456789ab';

function oldAuthUser() {
  return { user: { role: 'Cashier', email: 'not-an-identity@example.com' }, isLoading: false };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAccountPaymentActor', () => {
  it('uses a canonical ID already present in AuthContext without a profile request', () => {
    mockUseOptionalAuth.mockReturnValue({ user: { userId: actorId }, isLoading: false });

    const { result } = renderHook(() => useAccountPaymentActor());

    expect(result.current).toMatchObject({ actorId, status: 'ready' });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does not write redundant state when an auth adapter returns a fresh wrapper each render', () => {
    mockUseOptionalAuth.mockImplementation(() => ({ user: { userId: actorId }, isLoading: false }));

    const { result } = renderHook(() => useAccountPaymentActor());

    expect(result.current).toMatchObject({ actorId, status: 'ready' });
    expect(mockUseOptionalAuth).toHaveBeenCalledTimes(1);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('resolves an old authenticated session from the authoritative profile ID only', async () => {
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet.mockResolvedValue(actorId);

    const { result } = renderHook(() => useAccountPaymentActor());

    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current).toMatchObject({ actorId, status: 'ready' }));
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed identities instead of guessing from email or accepting an invalid stored ID', async () => {
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(() => useAccountPaymentActor());
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.actorId).toBeUndefined();

    mockUseOptionalAuth.mockReturnValue({ user: { userId: 'broken-id' }, isLoading: false });
    rerender();
    expect(result.current.status).toBe('failed');
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it('rejects the empty GUID returned by the profile endpoint', async () => {
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAccountPaymentActor());

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.actorId).toBeUndefined();
  });

  it('discards an old profile result after the authenticated user object changes', async () => {
    const oldUser = oldAuthUser();
    let currentAuth = oldUser;
    const oldProfile = deferred<string | undefined>();
    mockUseOptionalAuth.mockImplementation(() => currentAuth);
    mockApiGet.mockImplementationOnce(() => oldProfile.promise).mockResolvedValueOnce(otherActorId);

    const { result, rerender } = renderHook(() => useAccountPaymentActor());
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    currentAuth = oldAuthUser();
    rerender();

    await waitFor(() => expect(result.current).toMatchObject({ actorId: otherActorId, status: 'ready' }));
    await act(async () => {
      oldProfile.resolve(actorId);
      await oldProfile.promise;
    });
    expect(result.current).toMatchObject({ actorId: otherActorId, status: 'ready' });
  });

  it('retries a failed profile lookup without signing the user out', async () => {
    mockUseOptionalAuth.mockReturnValue(oldAuthUser());
    mockApiGet.mockRejectedValueOnce(new Error('private request failure')).mockResolvedValueOnce(actorId);

    const { result } = renderHook(() => useAccountPaymentActor());
    await waitFor(() => expect(result.current.status).toBe('failed'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current).toMatchObject({ actorId, status: 'ready' }));
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('does not query before auth hydration or without a signed-in user', () => {
    mockUseOptionalAuth.mockReturnValue({ user: null, isLoading: true });
    const { result, rerender } = renderHook(() => useAccountPaymentActor());
    expect(result.current.status).toBe('checking');
    expect(mockApiGet).not.toHaveBeenCalled();

    mockUseOptionalAuth.mockReturnValue({ user: null, isLoading: false });
    rerender();
    expect(result.current.status).toBe('failed');
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
