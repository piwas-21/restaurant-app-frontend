/**
 * API Client Utility
 *
 * Centralized HTTP client with error handling, authentication, and session management.
 * Uses fetch API with proper TypeScript typing and error handling.
 * Includes automatic token refresh on 401 responses.
 */

import { refreshToken } from '@/services/authService';

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
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

/**
 * Get authentication token from storage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Get session ID from storage
 */
function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rumi_session_id');
}

/**
 * Clear auth state and bounce to the login/home route. Called only for a
 * definitive session end — never for a transient refresh failure (see
 * refreshToken's `transient` flag), which would otherwise log users out on a
 * rate-limit or network blip.
 */
function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

/**
 * Request configuration options
 */
interface RequestConfig extends RequestInit {
  requireAuth?: boolean;
  requireSession?: boolean;
}

/**
 * Make HTTP request with error handling
 */
async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { requireAuth = false, requireSession = false, ...fetchConfig } = config;

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

      if (refreshResponse.success) {
        // Retry the original request with the freshly-stored token.
        token = getAuthToken();
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
      } else {
        // Genuine invalid/expired session — sign out and send to login.
        clearAuthAndRedirect();
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
      const message: string = data.message || data.title || '';
      const errors = data.errors
        ? Array.isArray(data.errors)
          ? data.errors
          : Object.values(data.errors).flat()
        : undefined;

      throw new ApiError(
        response.status,
        message,
        errors as string[] | undefined,
        typeof data.errorCode === 'string' ? data.errorCode : undefined,
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
