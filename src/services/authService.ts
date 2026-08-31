import { z } from 'zod';
import { loginSchema } from '../schemas/auth.schema';
import { ApiError, apiClient, getRequestLanguage } from '@/utils/apiClient';
import type { ApiResponse } from '@/types/user';

/**
 * NOTE — this module and `apiClient` import each other, deliberately and safely.
 *
 * `apiClient` imports `refreshToken` from here to retry a 401; the three helpers below import
 * `apiClient` to get a status-carrying `ApiError`. Neither module touches the other's bindings at
 * evaluation time — only inside function bodies — so the cycle resolves whichever loads first.
 * (`refreshToken` is a hoisted function declaration, so it is defined even in a half-evaluated
 * module; `apiClient` is a `const` object literal, which is why nothing here may reach for it at
 * the top level.)
 *
 * Two helpers must stay raw `fetch`, for DIFFERENT reasons — the recursion argument covers only the
 * first:
 *
 *   - `refreshToken`, because `apiClient`'s 401 branch calls it. Routing it back through would not
 *     merely recurse: `inFlightRefresh` collapses concurrent callers onto one promise, so the
 *     retry would await the very promise it is running inside. A deadlock, not a stack overflow.
 *   - `login`, because `apiClient` attaches `Authorization` from whatever token is in storage. A
 *     stale one turns a wrong-password 401 into a refresh attempt and, when that fails,
 *     `clearAuthAndRedirect()` — navigating away from the login page mid-sign-in.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const AUTH_API_URL = `${API_BASE_URL}/api/Auth`;

/**
 * Read one key, tolerating a browser that refuses storage.
 *
 * The `typeof window` guard is for SSR and is not the interesting case. The interesting one is
 * that **reading the `localStorage` property itself throws** `SecurityError` when site data is
 * blocked outright — Chrome's "block all cookies", Firefox with `dom.storage.enabled=false`, a
 * sandboxed iframe without `allow-same-origin`. That is a different failure from Safari private
 * mode, where the property resolves and only `setItem` throws, and guarding only the writes left
 * it live: `getSessionId` runs on the first line of `login()`, so the throw happened BEFORE the
 * request and `useLoginForm`'s catch reported "Failed to connect to the server" on a browser that
 * had never reached the network.
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
 * Get session ID from localStorage for basket merge on login
 */
function getSessionId(): string | null {
  return readStoredValue('rumi_session_id');
}

/**
 * Persist the freshly issued session tokens, tolerating a browser that refuses storage.
 *
 * `localStorage.setItem` throws for reasons that have nothing to do with the request that just
 * succeeded: Safari private browsing, a full origin quota, or site data blocked outright. Three of
 * the four sign-in paths already caught that and warned; `login` was the one that did not, so on
 * such a browser a **successful** sign-in threw out of this service and `useLoginForm`'s catch
 * reported "Failed to connect to the server" — a network diagnosis for a storage refusal, on a
 * response the server had already returned 200 for.
 *
 * Warn and continue rather than fail: the caller still has the tokens in the response and
 * `AuthContext` still holds the session in memory, so the tab works and only its survival across a
 * reload is lost. That is the trade the other three paths already made.
 */
function persistSession(tokens: { accessToken?: string; refreshToken?: string } | undefined): void {
  try {
    if (tokens?.accessToken) localStorage.setItem('auth_token', tokens.accessToken);
    if (tokens?.refreshToken) localStorage.setItem('refresh_token', tokens.refreshToken);
  } catch (e) {
    console.warn('Could not persist tokens to localStorage', e);
  }
}

export async function login(formData: z.infer<typeof loginSchema>) {
  const sessionId = getSessionId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await fetch(`${AUTH_API_URL}/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify(formData),
  });

  if (response.ok) {
    const data = await response.json();
    if (data.success) persistSession(data.data);
    return data;
  }

  return response.json();
}

/**
 * Result of a token-refresh attempt.
 *
 * `transient` marks a rate-limit (HTTP 429) or network failure, where the
 * session may still be valid and the caller should back off and KEEP the user
 * signed in — as opposed to a genuine invalid/expired refresh token, where the
 * session is over and the caller should sign out.
 */
export interface RefreshResult {
  success: boolean;
  transient?: boolean;
  message?: string;
}

interface RefreshPayload {
  success?: boolean;
  data?: { accessToken: string; refreshToken: string };
  message?: string;
}

// Same-tab callers share this promise. A dashboard can make several requests at once, and without
// this guard each 401 would rotate the refresh token independently.
let inFlightRefresh: Promise<RefreshResult> | null = null;

interface TokenSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
}

interface RefreshLockManager {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T>;
}

function readTokenSnapshot(): TokenSnapshot {
  return {
    accessToken: readStoredValue('auth_token'),
    refreshToken: readStoredValue('refresh_token'),
  };
}

function hasRotatedSince(snapshot: TokenSnapshot, current = readTokenSnapshot()): boolean {
  // A complete, different pair is another tab's successful rotation. Do not mistake a logout or a
  // half-written/unavailable storage value for one: retrying with no bearer would hide a real end.
  return (
    Boolean(current.accessToken && current.refreshToken) &&
    (current.accessToken !== snapshot.accessToken || current.refreshToken !== snapshot.refreshToken)
  );
}

function getRefreshLocks(): RefreshLockManager | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { locks?: RefreshLockManager }).locks;
  return typeof locks?.request === 'function' ? locks : null;
}

export function refreshToken(): Promise<RefreshResult> {
  inFlightRefresh ??= performRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(): Promise<RefreshResult> {
  // SSR guard: localStorage is client-only. Callers are already client-side, but match the other
  // storage helpers defensively.
  if (typeof window === 'undefined') return { success: false };

  const snapshot = readTokenSnapshot();
  if (!snapshot.accessToken || !snapshot.refreshToken) {
    return { success: false, message: 'No session to refresh' };
  }

  const refresh = () => refreshSerialized(snapshot);
  const locks = getRefreshLocks();
  // Web Locks coordinate across tabs. Browsers without it still get snapshot checks before and
  // after the request: a loser of a token-rotation race observes the winner's new pair and reports
  // success rather than letting apiClient clear that newer session.
  return locks ? locks.request('rumi-auth-refresh', { mode: 'exclusive' }, refresh) : refresh();
}

async function refreshSerialized(snapshot: TokenSnapshot): Promise<RefreshResult> {
  // A tab may have waited for the lock while another tab refreshed. Re-read only AFTER serialization;
  // the pair captured before waiting is deliberately stale at this point.
  if (hasRotatedSince(snapshot)) return { success: true };

  const current = readTokenSnapshot();
  if (!current.accessToken || !current.refreshToken) {
    return { success: false, message: 'No session to refresh' };
  }

  let response: Response;
  try {
    response = await fetch(`${AUTH_API_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: current.accessToken, refreshToken: current.refreshToken }),
    });
  } catch {
    // Offline / DNS / CORS — transient. Keep the session; the next request retries.
    return { success: false, transient: true, message: 'Network error while refreshing session' };
  }

  // 429 (rate-limited) or 5xx — transient. The 429 body is empty, so never parse it.
  if (response.status === 429 || response.status >= 500) {
    return { success: false, transient: true, message: 'Session refresh is temporarily unavailable' };
  }

  const data = (await response.json().catch(() => null)) as RefreshPayload | null;
  if (response.ok && data?.success && data.data) {
    persistSession(data.data);
    return { success: true };
  }

  // A non-transient rejection may be an old request that lost a fallback race. The second snapshot
  // is what prevents that old request from clearing the successful tab's newly rotated session.
  if (hasRotatedSince(snapshot)) return { success: true };

  // Anything else (invalid or expired refresh token) is a genuine session end.
  return { success: false, message: data?.message ?? 'Session expired' };
}

// Customer registration
export type CustomerRegistrationPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export async function registerCustomer(formData: CustomerRegistrationPayload) {
  // One of the two requests in the app whose Accept-Language becomes a stored fact rather than a
  // rendering hint: the backend freezes it on the new account (GAP-2 S4) and every later mail to
  // that person — starting with the verification mail this very call triggers — is written in it.
  // A raw `fetch` for the reasons in this module's header, so the header apiClient adds has to be
  // added here by hand. Read through the exported helper so there is one definition of it.
  const language = getRequestLanguage();

  const response = await fetch(`${API_BASE_URL}/api/User/register/customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'text/plain',
      ...(language ? { 'Accept-Language': language } : {}),
    },
    body: JSON.stringify(formData),
  });

  const data = await response.json();
  if (response.ok && data?.success) {
    persistSession(data.data);
  }
  return data;
}

/**
 * Forgot Password - Request password reset
 */
export interface ForgotPasswordCommand {
  email: string;
}

export async function forgotPassword(formData: ForgotPasswordCommand): Promise<ApiResponse<string>> {
  return apiClient.post<ApiResponse<string>>('/api/Auth/forgot-password', formData);
}

/**
 * Reset Password - Reset password with token
 */
export interface ResetPasswordCommand {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export async function resetPassword(formData: ResetPasswordCommand) {
  const response = await fetch(`${AUTH_API_URL}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  return response.json();
}

/**
 * Change Password - Change password for authenticated user
 */
export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function changePassword(formData: ChangePasswordCommand): Promise<ApiResponse<string>> {
  const response = await apiClient.post<ApiResponse<string>>('/api/Auth/change-password', formData, {
    requireAuth: true,
  });
  // The controller intentionally wraps handler refusals in HTTP 200 ApiResponse.Failure. Match the
  // other password write: turn that resolved refusal into ApiError so the form reads errors[] and
  // server message through its normal error path instead of announcing a false success.
  // Constructed INLINE rather than via `throwServerRefusal` (apiFormErrors): importing that module
  // here adds a third edge to the apiClient ↔ authService cycle, and under a jest mock factory the
  // extra hop captures the mock's half-built exports — `ApiError` arrives undefined (frontend
  // order/payment tests caught it). Same shape as `throwServerRefusal`, same reasoning as the NOTE
  // above: only function bodies may read the other module's bindings.
  if (!response.success) {
    throw new ApiError(200, response.message ?? '', Array.isArray(response.errors) ? response.errors : undefined);
  }
  return response;
}

/**
 * Does the signed-in account have a password at all?
 *
 * A Google/Apple sign-up has none, and `change-password` verifies `currentPassword` — so for that
 * account the change form can never succeed. This is the probe that tells the two apart; the
 * caller resolves the user from the bearer token, never from a body field.
 *
 * `signOutOn401: false` deliberately. This is a BACKGROUND probe nobody asked for: the account
 * page fires it on mount, and a dead session found by it would otherwise clear storage and
 * navigate away from inside `apiClient`, where the caller's own catch cannot stop it. The reads
 * the user DID ask for (their profile, their addresses) keep the default and end the session
 * themselves. The caller still gets the `ApiError(401)` and treats it as "assume a password".
 */
export async function hasPassword(): Promise<ApiResponse<boolean>> {
  return apiClient.get<ApiResponse<boolean>>('/api/Auth/has-password', {
    requireAuth: true,
    signOutOn401: false,
  });
}

/**
 * Set the FIRST password on an account that has none.
 *
 * The server rejects this when a password already exists — otherwise a stolen token could
 * overwrite a password without knowing it. That path is `change-password`, which proves the
 * current one.
 */
export interface SetPasswordCommand {
  newPassword: string;
  confirmPassword: string;
}

export async function setPassword(formData: SetPasswordCommand): Promise<ApiResponse<string>> {
  return apiClient.post<ApiResponse<string>>('/api/Auth/set-password', formData, { requireAuth: true });
}

/**
 * Send Email Verification
 */
export interface SendEmailVerificationCommand {
  email: string;
}

export async function sendEmailVerification(formData: SendEmailVerificationCommand) {
  const response = await fetch(`${AUTH_API_URL}/send-email-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  return response.json();
}

/**
 * Verify Email - Verify email address with token
 */
export interface VerifyEmailCommand {
  email: string;
  token: string;
}

export async function verifyEmail(formData: VerifyEmailCommand) {
  const response = await fetch(`${AUTH_API_URL}/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  return response.json();
}

export async function requestAccountDeletion(): Promise<ApiResponse<string>> {
  // `requireAuth` so a missing token fails HERE rather than as an anonymous request the server
  // answers with a 401 the client then has to interpret. The endpoint is `[Authorize]`, and its
  // expired-token 401 is the whole of #414: `apiClient` refreshes and retries, and on a genuinely
  // dead session clears the stored tokens and navigates to `/` — the HOME page, not `/auth/login`
  // (see `clearAuthAndRedirect`). That is still the answer the customer needed, because it ends the
  // dead session and puts a sign-in in reach; the raw `fetch` discarded the status entirely and
  // left them re-reading "an unexpected error" and retrying forever.
  return apiClient.post<ApiResponse<string>>('/api/User/request-deletion', undefined, { requireAuth: true });
}

export async function confirmAccountDeletion(data: { userId: string; token: string }): Promise<ApiResponse<string>> {
  // Deliberately NOT `requireAuth`: this one is `[AllowAnonymous]` and authenticates by the emailed
  // token in the body. It is followed from a mail client, where a stored session may not exist.
  return apiClient.post<ApiResponse<string>>('/api/User/confirm-deletion', data);
}

export async function googleLogin(idToken: string) {
  const sessionId = getSessionId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await fetch(`${AUTH_API_URL}/google-login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json();
  if (response.ok && data?.success) {
    persistSession(data.data);
  }
  return data;
}

export async function appleLogin(idToken: string, user?: { firstName: string; lastName: string }) {
  const sessionId = getSessionId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const response = await fetch(`${AUTH_API_URL}/apple-login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      idToken,
      firstName: user?.firstName,
      lastName: user?.lastName,
    }),
  });

  const data = await response.json();
  if (response.ok && data?.success) {
    persistSession(data.data);
  }
  return data;
}
