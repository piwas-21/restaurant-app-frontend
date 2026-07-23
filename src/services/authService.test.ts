import { refreshToken } from './authService';

/**
 * fix/auth-refresh-single-flight: the token refresh must (a) collapse concurrent
 * callers onto ONE network request (the stampede that raced the backend's
 * refresh-token rotation and drained the auth rate-limit bucket), and (b)
 * distinguish a transient failure (429 / network) — keep the session — from a
 * genuine invalid token — end the session.
 */
describe('authService.refreshToken', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'old-access');
    localStorage.setItem('refresh_token', 'old-refresh');
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const okResponse = () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
    }),
  });

  it('collapses concurrent calls into a single network refresh', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = refreshToken();
    const second = refreshToken();
    // Both callers share the one in-flight refresh.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(okResponse());
    const [r1, r2] = await Promise.all([first, second]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('new-access');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh');
  });

  it('starts a fresh refresh once the previous one has settled', async () => {
    fetchMock.mockResolvedValue(okResponse());

    await refreshToken();
    await refreshToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats HTTP 429 as transient without clearing tokens or parsing the empty body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => {
        throw new Error('empty body');
      },
    });

    const result = await refreshToken();

    expect(result.success).toBe(false);
    expect(result.transient).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('old-access');
    expect(localStorage.getItem('refresh_token')).toBe('old-refresh');
  });

  it('treats a 5xx server error as transient', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('empty body');
      },
    });

    const result = await refreshToken();

    expect(result.success).toBe(false);
    expect(result.transient).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('old-access');
  });

  it('treats a network error as transient', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await refreshToken();

    expect(result.success).toBe(false);
    expect(result.transient).toBe(true);
  });

  it('treats an invalid/expired refresh token as a definitive (non-transient) failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, message: 'Invalid token' }),
    });

    const result = await refreshToken();

    expect(result.success).toBe(false);
    expect(result.transient).toBeFalsy();
  });

  it('does not hit the network when there is no stored session', async () => {
    localStorage.clear();

    const result = await refreshToken();

    expect(result.success).toBe(false);
    expect(result.transient).toBeFalsy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
