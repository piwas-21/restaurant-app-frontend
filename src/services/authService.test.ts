import { login, refreshToken } from './authService';

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

/**
 * `login` was the one sign-in path that wrote the tokens to `localStorage` unguarded, while
 * `registerCustomer`, `googleLogin` and `appleLogin` all caught the write. That mattered because
 * the write happens AFTER a 200: a browser with site data blocked (Safari private browsing, a full
 * origin quota) threw out of a sign-in the server had already granted, and `useLoginForm`'s catch
 * reported "Failed to connect to the server" — a network diagnosis for a storage refusal.
 */
describe('authService.login and a browser that refuses storage', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const grantedResponse = {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: { accessToken: 'access-1', refreshToken: 'refresh-1', role: 'Customer' },
    }),
  };

  it('persists both tokens on a granted sign-in', async () => {
    fetchMock.mockResolvedValue(grantedResponse);

    const data = await login({ email: 'a@b.co', password: 'secret1' }); // pragma: allowlist secret -- fixture

    expect(data.success).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe('access-1');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-1');
  });

  it('RESOLVES with the granted envelope when localStorage throws', async () => {
    fetchMock.mockResolvedValue(grantedResponse);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

    // The assertion that matters: it does not reject. Rejecting is what put a network sentence on
    // a screen whose request had succeeded.
    const data = await login({ email: 'a@b.co', password: 'secret1' }); // pragma: allowlist secret -- fixture

    expect(data.success).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('RESOLVES when reading localStorage throws before the request is even made', async () => {
    // The other half, and the one guarding the WRITES left live. With site data blocked outright
    // (Chrome "block all cookies", a sandboxed iframe) the `localStorage` PROPERTY throws on
    // access — and `getSessionId()` is the first line of `login()`, so the throw beat `fetch`
    // entirely and `useLoginForm` reported a network failure for a request that never happened.
    fetchMock.mockResolvedValue(grantedResponse);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    });

    const data = await login({ email: 'a@b.co', password: 'secret1' }); // pragma: allowlist secret -- fixture

    expect(data.success).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns the refusal body for a non-2xx without touching storage', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, message: 'Account locked', errors: ['Too many failed attempts.'] }),
    });

    const data = await login({ email: 'a@b.co', password: 'nope' }); // pragma: allowlist secret -- fixture

    expect(data.errors).toEqual(['Too many failed attempts.']);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
