/**
 * `apiClient.request` — the invariant that makes E9's translated fallbacks reachable.
 *
 * The whole of E9 step 3 rests on `getErrorMessage(err) ?? t('contextual_key')`: the server's own
 * sentence when it authored one, a TRANSLATED contextual sentence when it did not. The second half
 * almost never ran, because `request()` manufactured a hardcoded English sentence on every failure
 * path before any caller's catch saw it, so `getErrorMessage` returned non-null and `??`
 * short-circuited. With the backend down, a Turkish admin read "Network error. Please check your
 * internet connection." (#401).
 *
 * The existing tests could not see it. They build `new ApiError(500, '')` by hand — a shape
 * `request()` could not emit — so they pinned `getErrorMessage`'s contract against an input that
 * never occurred in production. **These go through the real `request()`**, which is the only way to
 * assert what actually reaches a caller.
 *
 * Reached by RELATIVE path deliberately: `__mocks__/@/utils/apiClient.ts` shadows every
 * `@/utils/apiClient` import in the tree (see `apiClientMockContract.test.ts`), and importing the
 * alias here would test the double instead of the thing.
 */

import { apiClient, ApiError, getErrorMessage } from './apiClient';

jest.mock('@/services/authService', () => ({
  refreshToken: jest.fn(),
}));

const { refreshToken } = jest.requireMock('@/services/authService') as { refreshToken: jest.Mock };

/** A `Response` double narrow enough to drive `request()`'s branches and nothing else. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** What Caddy serves mid-deploy: a 502 whose body is HTML, so `response.json()` throws. */
function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`);
    },
  } as unknown as Response;
}

/**
 * The failure `request()` produced, as the object a caller's `catch` receives.
 *
 * ONE invocation. An earlier version called twice — once for a `rejects` assertion, once to
 * capture — and that is not a harmless duplicate: `clearAuthAndRedirect` removes the token on the
 * first call, so the second found `token === null`, skipped the `status === 401 && token` branch
 * entirely, and threw from the generic non-ok path instead. The assertions still passed, against
 * the wrong throw site. It also silently broke any caller using `mockResolvedValueOnce`.
 */
async function captureFailure(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject, and it resolved');
}

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});

/**
 * The point of the whole change. Each case is a real failure mode; the assertion is that NOTHING
 * this module wrote reaches the caller as a message, so the caller's own translated sentence wins.
 */
describe('request() never authors a message — so getErrorMessage can return null', () => {
  it('a dead network surfaces as status 0 with nothing to say', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await captureFailure(() => apiClient.get('/api/Menu'));

    expect(error.status).toBe(0);
    expect(error.message).toBe('');
    expect(getErrorMessage(error)).toBeNull();
  });

  it('an HTML 502 mid-deploy surfaces with nothing to say', async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse(502));

    const error = await captureFailure(() => apiClient.get('/api/Menu'));

    expect(error.message).toBe('');
    expect(getErrorMessage(error)).toBeNull();
  });

  it('a non-2xx whose body carries no message surfaces with nothing to say', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, {}));

    const error = await captureFailure(() => apiClient.get('/api/Menu'));

    expect(error.status).toBe(500);
    expect(error.message).toBe('');
    expect(getErrorMessage(error)).toBeNull();
  });

  it('a client-side refusal before the request surfaces with nothing to say', async () => {
    // `requireAuth` with no token: the server was never asked, so it authored nothing.
    global.fetch = jest.fn();

    const error = await captureFailure(() => apiClient.get('/api/User/me', { requireAuth: true }));

    expect(error.status).toBe(401);
    expect(error.message).toBe('');
    expect(getErrorMessage(error)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a missing session id surfaces with nothing to say', async () => {
    global.fetch = jest.fn();

    const error = await captureFailure(() => apiClient.post('/api/Basket/items', {}, { requireSession: true }));

    expect(error.status).toBe(400);
    expect(error.message).toBe('');
    expect(getErrorMessage(error)).toBeNull();
  });

  it('a transient refresh failure surfaces with nothing to say, and keeps the user signed in', async () => {
    // `performRefresh` never puts the SERVER's words on a transient result — the fetch catch and
    // the 429/5xx branch both return client-authored English, and the 429 body is never parsed.
    // Passing `refreshResponse.message` through was the least obvious of the seven English paths
    // precisely because it looks like it came from the backend.
    localStorage.setItem('auth_token', 'stale');
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {}));
    refreshToken.mockResolvedValue({
      success: false,
      transient: true,
      message: 'Session refresh is temporarily unavailable',
    });

    const error = await captureFailure(() => apiClient.get('/api/Order'));

    expect(error.status).toBe(429);
    expect(error.message).toBe('');
    expect(getErrorMessage(error)).toBeNull();
    expect(localStorage.getItem('auth_token')).toBe('stale');
  });

  it('a definitive session end surfaces with nothing to say, and clears auth', async () => {
    localStorage.setItem('auth_token', 'expired');
    localStorage.setItem('refresh_token', 'expired');
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {}));
    refreshToken.mockResolvedValue({ success: false, message: 'Session expired' });

    const error = await captureFailure(() => apiClient.get('/api/Order'));

    expect(error.status).toBe(401);
    expect(error.message).toBe('');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('a session another tab rotated is retried with the CURRENT token, not cleared', async () => {
    // The multi-tab race: this request's 401 arrived because ITS bearer was stale, but by the
    // time the refresh settles another tab has already rotated the pair. Clearing that NEWER
    // session because this request lost the race is exactly the forced re-login the owner
    // reported — so request() retries once with the token storage holds NOW.
    localStorage.setItem('auth_token', 'stale');
    localStorage.setItem('refresh_token', 'stale-refresh');
    const responses = [jsonResponse(401, {}), jsonResponse(200, { success: true, data: { ok: true } })];
    global.fetch = jest.fn().mockImplementation(async () => responses.shift() ?? jsonResponse(500, {}));
    refreshToken.mockImplementation(async () => {
      localStorage.setItem('auth_token', 'fresh');
      localStorage.setItem('refresh_token', 'fresh-refresh');
      return { success: false, message: 'Session expired' };
    });

    const data = await apiClient.get<{ success: boolean; data: { ok: boolean } }>('/api/Order');

    expect(data.data?.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const retry = (global.fetch as jest.Mock).mock.calls[1][1] as { headers: Record<string, string> };
    expect(retry.headers['Authorization']).toBe('Bearer fresh');
    expect(localStorage.getItem('auth_token')).toBe('fresh');
  });

  /**
   * A browser that blocks site data outright (Chrome "block all cookies", a sandboxed iframe)
   * throws `SecurityError` from `localStorage.getItem` ITSELF. Both reads run at the top of
   * `request()`, OUTSIDE its try — so before #414 guarded them the throw escaped raw, as a
   * `SecurityError` rather than an `ApiError`, before the request was ever sent. Every caller's
   * error handling then saw something it was not written for.
   *
   * This is the same failure `authService.readStoredValue` documents having already fixed once on
   * the sign-in path; these are the reads on the path every OTHER request takes. It matters most
   * where storage is most likely to be restricted — `/delete-account` opens from a mail webview.
   */
  describe('a browser that refuses storage', () => {
    const withThrowingStorage = (fn: () => void) => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        fn();
      } finally {
        spy.mockRestore();
        warn.mockRestore();
      }
    };

    it('sends the request anyway, without the headers it could not read', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));

      let pending!: Promise<unknown>;
      withThrowingStorage(() => {
        pending = apiClient.get('/api/Menu');
      });
      await expect(pending).resolves.toEqual({ ok: true });

      // A token that cannot be read is indistinguishable from not having one.
      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
      expect(headers['X-Session-Id']).toBeUndefined();
    });

    it('still refuses a requireAuth call as an ApiError, not a raw SecurityError', async () => {
      global.fetch = jest.fn();

      let pending!: Promise<unknown>;
      withThrowingStorage(() => {
        pending = apiClient.get('/api/User/me', { requireAuth: true });
      });
      const error = await pending.catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('a session end still ends as ApiError(401) when the CLEAR throws too', async () => {
      // `clearAuthAndRedirect` removes three keys. An unguarded throw there would replace the
      // ApiError(401) it precedes with a raw SecurityError — a handled session end becoming an
      // unhandled one, on the exact path #414 relies on.
      localStorage.setItem('auth_token', 'expired');
      localStorage.setItem('refresh_token', 'expired');
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {}));
      refreshToken.mockResolvedValue({ success: false, message: 'Session expired' });
      const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const error = await captureFailure(() => apiClient.get('/api/Order'));
        expect(error.status).toBe(401);
        expect(error.message).toBe('');
      } finally {
        remove.mockRestore();
        warn.mockRestore();
      }
    });
  });

  /**
   * All seven throw sites in `request()` in one place, so the invariant is stated once rather than
   * inferred from seven separate `it`s.
   *
   * It is an ENUMERATION, not a property: a throw site added to `request()` and not added here is
   * not exercised, and this test stays green. That is not hypothetical — the first draft of the
   * list omitted the two refresh outcomes, and a mutant restoring the 429's English survived it.
   * Adding a failure path to `request()` means adding a line here.
   *
   * The list is order-independent, but not because every entry resets storage — entries 1-5 are
   * simply storage-insensitive (none of them 401s with a token present). The four that ARE
   * sensitive say so: the pre-flight refusals `clear()` first, the refresh outcomes `setItem`
   * first. An entry 10 that cares about the token must do the same; without it a reorder would
   * silently turn the `requireAuth` entry into a second `TypeError` case, still green.
   */
  it('produces no English of its own on any of its seven throw paths', async () => {
    const paths: Array<() => Promise<unknown>> = [
      () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        return apiClient.get('/api/Menu');
      },
      () => {
        global.fetch = jest.fn().mockRejectedValue(new RangeError('something exotic'));
        return apiClient.get('/api/Menu');
      },
      () => {
        global.fetch = jest.fn().mockResolvedValue(htmlResponse(502));
        return apiClient.get('/api/Menu');
      },
      () => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse(404, {}));
        return apiClient.get('/api/Menu');
      },
      () => {
        global.fetch = jest.fn().mockResolvedValue(jsonResponse(400, { message: null, title: null }));
        return apiClient.put('/api/Menu/1', {});
      },
      () => {
        localStorage.clear();
        global.fetch = jest.fn();
        return apiClient.get('/api/User/me', { requireAuth: true });
      },
      () => {
        localStorage.clear();
        global.fetch = jest.fn();
        return apiClient.delete('/api/Basket/items/1', { requireSession: true });
      },
      // The two refresh outcomes.
      () => {
        localStorage.setItem('auth_token', 'stale');
        global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {}));
        refreshToken.mockResolvedValue({ success: false, transient: true, message: 'Session refresh unavailable' });
        return apiClient.get('/api/Order');
      },
      () => {
        localStorage.setItem('auth_token', 'expired');
        global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {}));
        refreshToken.mockResolvedValue({ success: false, message: 'Session expired' });
        return apiClient.get('/api/Order');
      },
    ];

    for (const path of paths) {
      await expect(path()).rejects.toMatchObject({ message: '' });
    }
  });
});

/**
 * The other half: the server's own words must still get through untouched. A fix that made
 * `getErrorMessage` return `null` for EVERYTHING would pass every assertion above and delete the
 * feature — the server's sentence is the specific, actionable one, and the translated fallback is
 * the consolation prize.
 */
describe('request() passes the SERVER’s account through unchanged', () => {
  it('keeps a message the server authored', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(409, { message: 'That slug is taken' }));

    const error = await captureFailure(() => apiClient.post('/api/Category', {}));

    expect(error.message).toBe('That slug is taken');
    expect(getErrorMessage(error)).toBe('That slug is taken');
  });

  it('falls back to `title` when the server used the ProblemDetails shape', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(400, { title: 'One or more validation errors occurred.' }));

    const error = await captureFailure(() => apiClient.post('/api/Category', {}));

    expect(error.message).toBe('One or more validation errors occurred.');
  });

  it('still reaches `title` when `message` is present but empty', async () => {
    // The `||` fallthrough, not a `typeof` test: an empty `message` is absence, and the ProblemDetails
    // `title` beside it is the real one.
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(400, { message: '', title: 'Validation failed' }));

    const error = await captureFailure(() => apiClient.post('/api/Category', {}));

    expect(error.message).toBe('Validation failed');
  });

  it('keeps per-rule messages and the error code', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        message: 'Validation failed',
        errors: ['Password must contain at least one uppercase letter'],
        errorCode: 'OrderTypeNotAvailable',
      }),
    );

    const error = await captureFailure(() => apiClient.post('/api/User/register/staff', {}));

    expect(error.errors).toEqual(['Password must contain at least one uppercase letter']);
    expect(error.errorCode).toBe('OrderTypeNotAvailable');
    expect(getErrorMessage(error)).toBe('Password must contain at least one uppercase letter');
  });

  it('flattens the ASP.NET per-field errors object', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(400, { errors: { Email: ['Already in use'], Password: ['Too short'] } }));

    const error = await captureFailure(() => apiClient.post('/api/User/register/staff', {}));

    expect(error.errors).toEqual(['Already in use', 'Too short']);
  });

  /**
   * …and KEEPS the keys it used to flatten away (#557). Flattening alone left every caller with a
   * raw DataAnnotation sentence naming a C# property; the keys are what let a form answer
   * "the party is over the cap" in the guest's own language instead of relaying it.
   */
  it('keeps the field keys of a problem+json refusal', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { NumberOfGuests: ['The field NumberOfGuests must be between 1 and 20.'] },
      }),
    );

    const error = await captureFailure(() => apiClient.post('/api/Reservations', {}));

    expect(error.fieldErrors).toEqual({ NumberOfGuests: ['The field NumberOfGuests must be between 1 and 20.'] });
    expect(error.errors).toEqual(['The field NumberOfGuests must be between 1 and 20.']);
  });

  it('keeps the `"$"` key of a JsonRequired refusal, which names no field at all', async () => {
    // The deserializer runs BEFORE model validation, so this is what an omitted `[JsonRequired]`
    // member answers — a client reading `errors.endTime` finds nothing (contract §0.2).
    const blob =
      "JSON deserialization for type 'UpdateMyReservationDto' was missing required properties including: 'endTime'.";
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { title: 'One or more validation errors occurred.', errors: { $: [blob] } }),
      );

    const error = await captureFailure(() => apiClient.put('/api/Reservations/1/mine', {}));

    expect(error.fieldErrors).toEqual({ $: [blob] });
  });

  it('leaves `fieldErrors` unset for the ApiResponse envelope, whose `errors` is an ARRAY', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(400, { message: 'Operation failed', errors: ['Table 5 is gone'] }));

    const error = await captureFailure(() => apiClient.post('/api/Reservations', {}));

    expect(error.fieldErrors).toBeUndefined();
    expect(error.errors).toEqual(['Table 5 is gone']);
  });

  it('leaves both unset when the body carries no errors member at all', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, { message: 'Boom' }));

    const error = await captureFailure(() => apiClient.get('/api/Reservations'));

    expect(error.fieldErrors).toBeUndefined();
    expect(error.errors).toBeUndefined();
  });
});

/**
 * What replaces the prose. The old strings were the only thing a developer had, and two of the
 * three said nothing a status code did not — while the `SyntaxError` from an HTML 502, the one
 * genuinely diagnostic text in the set, was discarded outright.
 */
describe('the diagnostic survives in `cause`, where nothing renders it', () => {
  it('chains the TypeError from a dead network', async () => {
    const thrown = new TypeError('Failed to fetch');
    global.fetch = jest.fn().mockRejectedValue(thrown);

    const error = await captureFailure(() => apiClient.get('/api/Menu'));

    expect(error.cause).toBe(thrown);
  });

  it('chains the SyntaxError from an HTML 502 — which used to be thrown away entirely', async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse(502));

    const error = await captureFailure(() => apiClient.get('/api/Menu'));

    expect(error.cause).toBeInstanceOf(SyntaxError);
    expect((error.cause as SyntaxError).message).toContain('<!DOCTYPE');
  });
});

describe('the success paths are untouched', () => {
  it('returns the parsed body', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { success: true, data: [1, 2] }));

    await expect(apiClient.get('/api/Menu')).resolves.toEqual({ success: true, data: [1, 2] });
  });

  it('returns an empty object for 204, without parsing', async () => {
    const json = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204, json } as unknown as Response);

    await expect(apiClient.delete('/api/Category/1')).resolves.toEqual({});
    expect(json).not.toHaveBeenCalled();
  });

  it('retries once with the refreshed token after a 401', async () => {
    localStorage.setItem('auth_token', 'stale');
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    refreshToken.mockImplementation(async () => {
      localStorage.setItem('auth_token', 'fresh');
      return { success: true };
    });

    await expect(apiClient.get('/api/Order')).resolves.toEqual({ ok: true });
    const retryHeaders = (global.fetch as jest.Mock).mock.calls[1][1].headers;
    expect(retryHeaders.Authorization).toBe('Bearer fresh');
  });

  it.each([
    ['postFormData', () => apiClient.postFormData('/api/Category/image', new FormData()), 'POST'],
    ['putFormData', () => apiClient.putFormData('/api/Category/1/image', new FormData()), 'PUT'],
  ])('%s does not set Content-Type, so the browser can add the multipart boundary', async (_l, call, method) => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await call();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe(method);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('leaves an absolute URL alone rather than prefixing the API base', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await apiClient.get('https://cdn.example.test/manifest.json');

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://cdn.example.test/manifest.json');
  });

  it('does not retry when the refresh reports success but stored no token', async () => {
    // Not a hypothetical: `performRefresh` writes the token and returns success as two steps, and
    // a quota-exceeded `localStorage.setItem` separates them. The original 401 must still surface.
    localStorage.setItem('auth_token', 'stale');
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    refreshToken.mockImplementation(async () => {
      localStorage.removeItem('auth_token');
      return { success: true };
    });

    await expect(apiClient.get('/api/Order')).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['post', (b?: unknown) => apiClient.post('/api/Order', b), 'POST'],
    ['put', (b?: unknown) => apiClient.put('/api/Order/1', b), 'PUT'],
    ['patch', (b?: unknown) => apiClient.patch('/api/Order/1', b), 'PATCH'],
  ])('%s serialises a JSON body, and sends none when there is nothing to send', async (_l, call, method) => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await call({ status: 2 });
    await call();

    const [withBody, withoutBody] = (global.fetch as jest.Mock).mock.calls;
    expect(withBody[1].method).toBe(method);
    expect(withBody[1].body).toBe('{"status":2}');
    expect(withBody[1].headers['Content-Type']).toBe('application/json');
    expect(withoutBody[1].body).toBeUndefined();
  });

  it.each([
    ['post', () => apiClient.post('/api/Category/image', new FormData())],
    ['put', () => apiClient.put('/api/Category/1/image', new FormData())],
  ])('%s passes FormData through without stringifying it or setting Content-Type', async (_l, call) => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await call();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  /**
   * Header precedence is ASYMMETRIC and nothing else states it. Caller headers merge AFTER
   * `Content-Type` but BEFORE `Authorization` and `X-Session-Id`, so a caller can override the
   * first and silently cannot override the other two. Worth pinning rather than describing: the
   * merge is one `Object.assign` whose position in the function is the whole contract.
   */
  it('attaches auth + session headers, and merges caller headers around them', async () => {
    localStorage.setItem('auth_token', 'real-token');
    localStorage.setItem('rumi_session_id', 'real-session');
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await apiClient.get('/api/Basket', {
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'text/csv',
        Authorization: 'Bearer caller-token',
        'X-Session-Id': 'caller-session',
      },
      requireSession: true,
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    // Passed through untouched — `request()` never sets it.
    expect(init.headers.Accept).toBe('text/plain');
    // Caller WINS: set before the merge.
    expect(init.headers['Content-Type']).toBe('text/csv');
    // Caller LOSES: both are written after the merge, from storage.
    expect(init.headers.Authorization).toBe('Bearer real-token');
    expect(init.headers['X-Session-Id']).toBe('real-session');
  });

  it('attaches the session header when the caller supplies none', async () => {
    localStorage.setItem('rumi_session_id', 'sess-1');
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, {}));

    await apiClient.get('/api/Basket', { requireSession: true });

    expect((global.fetch as jest.Mock).mock.calls[0][1].headers['X-Session-Id']).toBe('sess-1');
  });
});
