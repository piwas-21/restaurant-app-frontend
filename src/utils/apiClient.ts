/**
 * API Client Utility
 *
 * Centralized HTTP client with error handling, authentication, and session management.
 * Uses fetch API with proper TypeScript typing and error handling.
 * Includes automatic token refresh on 401 responses.
 */

import { refreshToken } from '@/services/authService';
import { parseProblemFieldErrors, problemFieldMessages, type ProblemFieldErrors } from '@/utils/problemDetails';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5221';

/**
 * Custom error class for API errors
 *
 * `message` is **the server's own account of the failure, or `''` when it authored none.** That is
 * an invariant, not a description: nothing in this file may put client-written prose there. It used
 * to, on all seven throw paths below, and the consequence was that `getErrorMessage`'s documented
 * `null` contract almost never fired — every caller's *translated* fallback sat unreachable behind
 * an English sentence this module had invented (#401). With the backend down, a Turkish admin read
 * "Network error. Please check your internet connection."
 *
 * What replaces the prose is `status` (already there, and the only part of it that carried
 * information) plus `cause` for the client-side throws, which is strictly more than the old strings
 * said — the `SyntaxError` text from an HTML 502 used to be discarded outright.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    /** The SERVER's sentence, or `''`. Never client-authored — see the class doc. */
    public message: string,
    public errors?: string[],
    /**
     * Backend `ApiResponse.ErrorCode` — a stable PascalCase discriminator (`ErrorCodes.cs`) that
     * only some failures carry. It is what lets a caller act on ONE failure mode without
     * substring-matching an English message that would break the day the backend localises.
     */
    public errorCode?: string,
    /**
     * Carries the original throw (`TypeError` from a dead network, `SyntaxError` from an HTML 502)
     * on the paths where `message` is deliberately empty. It is a DIAGNOSTIC — devtools and
     * `console.error` chain it — and must never be rendered: those texts are the ones E9 removed
     * from users' screens in the first place.
     */
    options?: ErrorOptions,
    /**
     * The FIELD KEYS of an RFC 7807 `ValidationProblemDetails` refusal, present only on that shape
     * (`utils/problemDetails.ts`). `errors` keeps the same messages flattened, so nothing that read
     * it before sees a change; this is the half that used to be thrown away — `Object.values().flat()`
     * knew which member the backend refused and dropped it on the floor, leaving every caller to
     * show a raw DataAnnotation sentence naming a C# property, or the `"$"` deserializer's
     * stringified type name. A caller can now answer "the party is over the cap" in the guest's own
     * language instead of relaying either.
     */
    public fieldErrors?: ProblemFieldErrors,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

/**
 * Read one key, tolerating a browser that refuses storage.
 *
 * The `typeof window` guard is for SSR and is not the interesting case. The interesting one is that
 * **reading the `localStorage` property itself throws** `SecurityError` when site data is blocked
 * outright — Chrome's "block all cookies", Firefox with `dom.storage.enabled=false`, a sandboxed
 * iframe without `allow-same-origin`. Both callers below run at the TOP of `request()`, outside its
 * try, so an unguarded throw escaped as a raw `SecurityError` — not an `ApiError` — before the
 * request was ever sent, and every caller's error handling saw something it was not written for.
 *
 * `authService.readStoredValue` already learned this (see its doc: the same throw made a sign-in
 * report "Failed to connect to the server" on a browser that had never reached the network). This
 * is the same fix on the path every other request takes. It matters most where storage is most
 * likely to be restricted: `/delete-account` is opened from a mail-client webview.
 *
 * Warn and continue: a token we cannot read is indistinguishable from not having one, which the
 * request path already handles (`requireAuth` throws a 401 for it).
 */
function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`Could not read ${key} from localStorage`, e);
    return null;
  }
}

/**
 * The language every request tells the backend it is in (`Accept-Language`).
 *
 * This is the ONLY channel the guest's language reaches the server on — GAP-2 S4 freezes it onto
 * the order/reservation/account row at creation and every mail about that row is then written in
 * it (EMAIL-LOCALISATION-PLAN §1 rank 3). A checkout that sends no header produces a row carrying
 * the tenant's language instead of the diner's, and the receipt arrives in the wrong one.
 *
 * Read from `i18nextLng` in storage rather than from the i18next singleton, and that is a size
 * decision, not a taste one: `import i18n from 'i18next'` here pulls the i18next runtime into every
 * route that touches this module — measured at +13 kB first-load on `/dev-portal`, which is over
 * its budget in `scripts/check-bundle-size.mjs`. The key holds the same value: `src/i18n.ts` sets
 * `detection.caches: ['localStorage']`, so the detector writes it on first visit, and
 * `LanguageSwitcher` writes it on every explicit choice. When storage is unreadable or nothing has
 * been detected yet there is no header, which resolves to the tenant's language rather than a guess.
 *
 * SSR sends nothing at all (the guard is inside `readStoredValue`) — there is no user there, and a
 * server-rendered call must not put the container's locale on the wire.
 *
 * The value may be a REGION tag (`fr-CH`): i18next stores what it detected, and the backend reduces
 * a tag to its primary subtag itself (`LanguageCode.Normalize`). Do not "fix" it into a split here —
 * a header is a weighted list to the server, and the one thing that must not happen is this sending
 * something that is not a well-formed tag.
 *
 * `Accept-Language` is a CORS-safelisted request header, so this adds no preflight.
 */
export function getRequestLanguage(): string | null {
  return readStoredValue('i18nextLng');
}

function getAuthToken(): string | null {
  return readStoredValue('auth_token');
}

function getSessionId(): string | null {
  return readStoredValue('rumi_session_id');
}

/**
 * Clear auth state and bounce to the HOME route (`/`, not `/auth/login`). Called only for a
 * definitive session end — never for a transient refresh failure (see refreshToken's `transient`
 * flag), which would otherwise log users out on a rate-limit or network blip.
 *
 * The removals are wrapped for the same reason the reads above are: on a browser that blocks site
 * data, touching `localStorage` throws, and a throw HERE would replace the `ApiError(401)` this
 * function precedes with a raw `SecurityError` — turning a handled session end into an unhandled
 * one. Clearing is best-effort; the redirect is what actually ends the session for the user.
 */
function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  } catch (e) {
    console.warn('Could not clear auth state from localStorage', e);
  }
  window.location.href = '/';
}

/**
 * Request configuration options
 */
interface RequestConfig extends RequestInit {
  requireAuth?: boolean;
  requireSession?: boolean;
  /**
   * Whether a definitively dead session should END the session — clear storage and bounce to `/`.
   * Default `true`, which is right for anything a user asked for: they cannot continue anyway.
   *
   * `false` is for a BACKGROUND write nobody asked for. That distinction is not cosmetic: the
   * redirect happens inside this module, so a caller's own try/catch cannot stop it, and a
   * best-effort language write fired from a menu click (`saveLanguagePreference`) would otherwise
   * be able to throw away a half-filled checkout form the moment a refresh token expired. The
   * caller still gets its `ApiError(401)` and can decide to do nothing with it, which is the point.
   */
  signOutOn401?: boolean;
}

/**
 * Make HTTP request with error handling
 */
async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { requireAuth = false, requireSession = false, signOutOn401 = true, ...fetchConfig } = config;

  // Build headers
  const headers: Record<string, string> = {};

  // Only set Content-Type for non-FormData bodies
  if (!(fetchConfig.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Merge existing headers if provided
  if (fetchConfig.headers) {
    const existingHeaders = fetchConfig.headers as Record<string, string>;
    Object.assign(headers, existingHeaders);
  }

  // Set before the auth token, and deliberately NOT overwriting a caller's own value: a caller
  // that asked for a specific language means it.
  const language = getRequestLanguage();
  if (language && !headers['Accept-Language']) {
    headers['Accept-Language'] = language;
  }

  // Add authentication token if available or required
  let token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requireAuth) {
    // No message: the server was never asked, so it authored nothing. `status` says the rest.
    throw new ApiError(401, '');
  }

  // Add session ID if available or required
  const sessionId = getSessionId();
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  } else if (requireSession) {
    throw new ApiError(400, '');
  }

  // Build URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    // Make request
    let response = await fetch(url, {
      ...fetchConfig,
      headers,
    });

    // Handle 401 Unauthorized - try to refresh the token and retry once.
    if (response.status === 401 && token) {
      const refreshResponse = await refreshToken();
      // Capture once after refresh settles. A second read could turn a logout between the condition
      // and header construction into `Bearer null`.
      const currentToken = getAuthToken();

      if (refreshResponse.success) {
        // Retry the original request with the freshly-stored token.
        token = currentToken;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          response = await fetch(url, {
            ...fetchConfig,
            headers,
          });
        }
      } else if (refreshResponse.transient) {
        // Rate-limited (429) or network blip while refreshing — the session may
        // still be valid, so do NOT sign the user out. Surface a retriable error.
        //
        // `refreshResponse.message` is NOT passed through, and it reads as though it should be.
        // Every `transient` result in `performRefresh` is client-authored English: the `fetch`
        // catch returns 'Network error while refreshing session', and the 429/5xx branch returns
        // 'Session refresh is temporarily unavailable' WITHOUT parsing the body (it says so — a
        // 429 body is empty). The one branch that can carry the server's own words, `data?.message`,
        // is the NON-transient one, and it ends at the sign-out below.
        throw new ApiError(429, '');
      } else if (currentToken && currentToken !== token) {
        // A different tab rotated the pair after this request received its 401. Never clear that
        // newer session because this request used an old bearer; retry once with the current token.
        token = currentToken;
        headers['Authorization'] = `Bearer ${token}`;
        response = await fetch(url, { ...fetchConfig, headers });
      } else if (signOutOn401) {
        // Genuine invalid/expired session — sign out and send to login.
        clearAuthAndRedirect();
        throw new ApiError(401, '');
      } else {
        // The same dead session, reported rather than acted on: this call was a background
        // best-effort write, and ending someone's session — and navigating them away — because a
        // write THEY DID NOT ASK FOR found an expired token is a worse outcome than the write not
        // happening. The next request the user actually makes signs them out.
        throw new ApiError(401, '');
      }
    }

    // Handle non-JSON responses (like 204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    // Parse JSON response
    const data = await response.json();

    // Handle error responses
    if (!response.ok) {
      // Extract error message and details. `''` when the server said nothing usable — the status
      // is already on the error, so a `Request failed with status 500` string added no information
      // and cost every caller its translated fallback.
      //
      // `data.title` is the problem+json half of that: an `ApiResponse` failure has `message`, a
      // `ValidationProblemDetails` has `title` ("One or more validation errors occurred.").
      const message: string = data.message || data.title || '';
      // The two shapes of `errors`, kept apart: an ARRAY is the `ApiResponse` envelope, an OBJECT
      // is problem+json keyed by field (or by `"$"` when the body itself did not bind). Both end up
      // in `errors` as flat messages — as before — but the field keys now survive on the error too,
      // so a caller can recognise WHICH rule was broken instead of matching English prose.
      const fieldErrors = parseProblemFieldErrors(data);
      let errors: string[] | undefined;
      if (Array.isArray(data.errors)) {
        errors = data.errors as string[];
      } else if (fieldErrors) {
        errors = problemFieldMessages(fieldErrors);
      }

      throw new ApiError(
        response.status,
        message,
        errors,
        typeof data.errorCode === 'string' ? data.errorCode : undefined,
        undefined,
        fieldErrors ?? undefined,
      );
    }

    // Return successful response
    return data as T;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors. Status 0 is the signal; the `TypeError`'s own text ("Failed to fetch")
    // goes to `cause` for devtools, never to `message`, because it is not fit to render.
    if (error instanceof TypeError) {
      throw new ApiError(0, '', undefined, undefined, { cause: error });
    }

    // Anything else — in practice the `SyntaxError` from `response.json()` when Caddy serves an
    // HTML 502 mid-deploy. That text used to be thrown away entirely; `cause` keeps it.
    throw new ApiError(500, '', undefined, undefined, { cause: error });
  }
}

/**
 * HTTP methods
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, config?: RequestConfig): Promise<T> => {
    return request<T>(endpoint, { ...config, method: 'GET' });
  },

  /**
   * POST request
   */
  post: <T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> => {
    // Support both FormData and JSON
    const requestBody = body instanceof FormData ? body : body ? JSON.stringify(body) : undefined;
    return request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: requestBody,
    });
  },

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> => {
    // Support both FormData and JSON
    const requestBody = body instanceof FormData ? body : body ? JSON.stringify(body) : undefined;
    return request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: requestBody,
    });
  },

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> => {
    return request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, config?: RequestConfig): Promise<T> => {
    return request<T>(endpoint, { ...config, method: 'DELETE' });
  },

  /**
   * POST FormData request (for backward compatibility)
   */
  postFormData: <T>(endpoint: string, formData: FormData, config?: RequestConfig): Promise<T> => {
    return request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: formData,
    });
  },

  /**
   * PUT FormData request (for backward compatibility)
   */
  putFormData: <T>(endpoint: string, formData: FormData, config?: RequestConfig): Promise<T> => {
    return request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: formData,
    });
  },
};

/**
 * The SERVER's own account of a failure, or `null` when it did not author one.
 *
 * It used to end `return 'An unexpected error occurred';` — a hardcoded English literal, and
 * verbatim the string BUGS-IMPROVEMENTS-PLAN E9 was reported for. Every caller therefore had a
 * translated generic available for free, in English, without deciding to use one. Returning `null`
 * removes the option: a caller must now supply its own translated sentence, and the ones that
 * already had a better sentence than "an unexpected error occurred" now get to use it.
 *
 * A non-`ApiError` throw returns `null` too, deliberately. The things that reach a catch are
 * `TypeError` from a dead network and `SyntaxError` from `response.json()` when Caddy serves an
 * HTML 502 mid-deploy; passing those through put `Failed to fetch` and
 * `Unexpected token '<', "<!DOCTYPE "...` in front of users. Server prose is worth showing
 * untranslated because it is specific; a client-side throw is neither.
 *
 * **That rationale was correct and, until #401, described almost nothing.** `request()` catches
 * both of those and rethrows them as `ApiError`s carrying an English sentence it wrote itself, so
 * a caller's catch never saw the raw throw and this function never returned `null` for it — the
 * `?? t('…')` half of the E9 recipe was unreachable on the single most common failure there is,
 * the backend being down. The paragraph above held only for callers that bypass `request()`, and
 * there are none. `request()` now leaves `message` empty on every client-authored path, which is
 * what makes the `null` real.
 *
 * Same distinction `apiFormErrors.serverAuthoredMessage` draws — this is the non-form half of it.
 */
export function getErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError) {
    const detail = error.errors?.filter((m) => m?.trim()).join(', ');
    // `presentable`, inlined: `''` and `'   '` are absence wearing a costume, and an error line
    // with nothing in it says the operation failed for no reason.
    return detail || error.message?.trim() || null;
  }

  return null;
}

/**
 * Helper to check if error is specific status code
 */
export function isErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

/**
 * Helper to check if error is authentication error
 */
export function isAuthError(error: unknown): boolean {
  return isErrorStatus(error, 401);
}

/**
 * Helper to check if error is validation error
 */
export function isValidationError(error: unknown): boolean {
  return isErrorStatus(error, 400);
}

/**
 * Helper to check if error is not found error
 */
export function isNotFoundError(error: unknown): boolean {
  return isErrorStatus(error, 404);
}
