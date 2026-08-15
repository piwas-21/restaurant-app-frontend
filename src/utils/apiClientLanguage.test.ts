/**
 * GAP-2 S6 — `Accept-Language` on every request, because it is the ONLY channel the guest's
 * language reaches the server on.
 *
 * S4 freezes what this header says onto the order, reservation or account being created, and S5
 * writes every later mail about that row in it (EMAIL-LOCALISATION-PLAN §1 rank 3). So a request
 * that omits it does not merely render in English — it silently records the TENANT's language as
 * the diner's, permanently, and the receipt arrives in the wrong one. That is why these assertions
 * are on the header rather than on anything visible.
 *
 * Reached by RELATIVE path for the same reason `apiClientRequest.test.ts` is: the manual mock at
 * `__mocks__/@/utils/apiClient.ts` shadows the alias, and its `getRequestLanguage` answers null.
 */

import { apiClient, ApiError, getRequestLanguage } from './apiClient';

jest.mock('@/services/authService', () => ({
  refreshToken: jest.fn(),
}));

const { refreshToken } = jest.requireMock('@/services/authService') as { refreshToken: jest.Mock };

/** What i18next caches under `detection.caches: ['localStorage']`, and what the switcher writes. */
function readingIn(language: string) {
  localStorage.setItem('i18nextLng', language);
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
    status,
  } as unknown as Response;
}

/**
 * Headers are SNAPSHOTTED per call, not read back at the end: `request()` reuses one header object
 * across the initial call and the 401 retry, so inspecting `mock.calls` afterwards would show the
 * final state twice and could not see a header added or removed between the two.
 */
const sentHeaders: Record<string, string>[] = [];

function respondWith(...responses: Response[]) {
  let call = 0;
  global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
    sentHeaders.push({ ...(init.headers as Record<string, string>) });
    return Promise.resolve(responses[Math.min(call++, responses.length - 1)]);
  });
}

beforeEach(() => {
  localStorage.clear();
  sentHeaders.length = 0;
  jest.resetAllMocks();
  readingIn('fr');
});

describe('every verb carries the language the user is reading in', () => {
  it.each([
    ['get', () => apiClient.get('/api/Menu')],
    ['post', () => apiClient.post('/api/orders', { a: 1 })],
    ['put', () => apiClient.put('/api/User/profile', { a: 1 })],
    ['patch', () => apiClient.patch('/api/orders/1', { a: 1 })],
    ['delete', () => apiClient.delete('/api/orders/1')],
  ])('%s', async (_verb, call) => {
    respondWith(jsonResponse(200, {}));

    await call();

    expect(sentHeaders[0]['Accept-Language']).toBe('fr');
  });

  /** A multipart upload builds its headers down the other branch — no `Content-Type`, same language. */
  it('a FormData body carries it too', async () => {
    respondWith(jsonResponse(200, {}));

    await apiClient.post('/api/Products/1/images', new FormData());

    expect(sentHeaders[0]['Accept-Language']).toBe('fr');
    expect(sentHeaders[0]['Content-Type']).toBeUndefined();
  });

  it('sends whatever the current choice is, not a snapshot taken at import time', async () => {
    respondWith(jsonResponse(200, {}));
    readingIn('ar');

    await apiClient.get('/api/Menu');

    expect(sentHeaders[0]['Accept-Language']).toBe('ar');
  });

  /**
   * A region tag is passed through on purpose: the server reduces it to its primary subtag itself,
   * and half-parsing a language tag in the client is how a header stops being a valid one.
   */
  it('passes a region tag through unchanged', async () => {
    respondWith(jsonResponse(200, {}));
    readingIn('fr-CH');

    await apiClient.get('/api/Menu');

    expect(sentHeaders[0]['Accept-Language']).toBe('fr-CH');
  });

  it('sends none before anything has been detected, rather than guessing', async () => {
    respondWith(jsonResponse(200, {}));
    localStorage.removeItem('i18nextLng');

    await apiClient.get('/api/Menu');

    expect(sentHeaders[0]['Accept-Language']).toBeUndefined();
    expect(getRequestLanguage()).toBeNull();
  });

  it("does not overwrite a caller's own header", async () => {
    respondWith(jsonResponse(200, {}));

    await apiClient.get('/api/Menu', { headers: { 'Accept-Language': 'zh' } });

    expect(sentHeaders[0]['Accept-Language']).toBe('zh');
  });
});

/**
 * The retry is the case worth pinning hardest, and the one a naive implementation drops: it is a
 * SECOND `fetch`, and on the checkout path it is routinely the one that creates the order — a
 * logged-in diner whose access token expired mid-checkout would otherwise have their language read
 * off nothing at all.
 */
it('the retry after a 401 still carries it', async () => {
  localStorage.setItem('auth_token', 'expired-token');
  readingIn('fr');
  refreshToken.mockResolvedValue({ success: true });
  respondWith(jsonResponse(401, {}), jsonResponse(200, { ok: true }));

  await apiClient.post('/api/orders', { a: 1 });

  expect(sentHeaders).toHaveLength(2);
  expect(sentHeaders[1]['Accept-Language']).toBe('fr');
});

/**
 * `signOutOn401` — a background write must not be able to end someone's session.
 *
 * The redirect lives inside this module, so a caller's try/catch cannot undo it: without the opt-out
 * a best-effort language write fired from a menu click could clear storage and navigate a diner away
 * from a half-filled checkout form the moment their refresh token expired.
 */
describe('a dead session ends the session only when the user asked for the call', () => {
  beforeEach(() => {
    localStorage.setItem('auth_token', 'expired-token');
    localStorage.setItem('refresh_token', 'expired-refresh');
    localStorage.setItem('user', '{"firstName":"Ada"}');
    refreshToken.mockResolvedValue({ success: false });
    respondWith(jsonResponse(401, {}));
  });

  it('by default it clears the stored session', async () => {
    await expect(apiClient.get('/api/User/profile')).rejects.toBeInstanceOf(ApiError);

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('with signOutOn401: false it reports the 401 and leaves the session alone', async () => {
    const failure = await apiClient
      .get('/api/User/profile', { signOutOn401: false })
      .catch((error: unknown) => error as ApiError);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
    expect(localStorage.getItem('auth_token')).toBe('expired-token');
    expect(localStorage.getItem('user')).toBe('{"firstName":"Ada"}');
  });
});
