import { z } from 'zod';
import { loginSchema } from '../schemas/auth.schema';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const AUTH_API_URL = `${API_BASE_URL}/api/Auth`;

/**
 * Get session ID from localStorage for basket merge on login
 */
function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rumi_session_id');
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
    if (data.success) {
      localStorage.setItem('auth_token', data.data.accessToken);
      localStorage.setItem('refresh_token', data.data.refreshToken);
    }
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

// Single-flight guard. Many requests can 401 at once (a dashboard fires several
// calls in parallel) and AuthContext also validates on mount. Without this each
// caller would POST its own /refresh-token — a stampede that (a) raced the
// backend's refresh-token rotation, invalidating each other and logging the user
// out, and (b) drained the auth rate-limit bucket, 429-ing the re-login.
// Collapsing concurrent callers onto one in-flight promise removes both.
let inFlightRefresh: Promise<RefreshResult> | null = null;

export function refreshToken(): Promise<RefreshResult> {
  inFlightRefresh ??= performRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefresh(): Promise<RefreshResult> {
  // SSR guard: localStorage is client-only. Callers are already client-side, but
  // match the other storage helpers defensively.
  if (typeof window === 'undefined') {
    return { success: false };
  }

  const accessToken = localStorage.getItem('auth_token');
  const storedRefreshToken = localStorage.getItem('refresh_token');

  // Nothing to refresh — a definitive (non-transient) miss.
  if (!accessToken || !storedRefreshToken) {
    return { success: false, message: 'No session to refresh' };
  }

  let response: Response;
  try {
    response = await fetch(`${AUTH_API_URL}/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken, refreshToken: storedRefreshToken }),
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
    localStorage.setItem('auth_token', data.data.accessToken);
    localStorage.setItem('refresh_token', data.data.refreshToken);
    return { success: true };
  }

  // Anything else (invalid or rotated-away refresh token) is a genuine session end.
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
  const response = await fetch(`${API_BASE_URL}/api/User/register/customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'text/plain',
    },
    body: JSON.stringify(formData),
  });

  const data = await response.json();
  if (response.ok && data?.success) {
    try {
      if (data.data?.accessToken) localStorage.setItem('auth_token', data.data.accessToken);
      if (data.data?.refreshToken) localStorage.setItem('refresh_token', data.data.refreshToken);
    } catch (e) {
      // localStorage may be unavailable; ignore and let caller proceed
      console.warn('Could not persist tokens to localStorage', e);
    }
  }
  return data;
}

/**
 * Forgot Password - Request password reset
 */
export interface ForgotPasswordCommand {
  email: string;
}

export async function forgotPassword(formData: ForgotPasswordCommand) {
  const response = await fetch(`${AUTH_API_URL}/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  });

  return response.json();
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

export async function changePassword(formData: ChangePasswordCommand) {
  const token = localStorage.getItem('auth_token');

  const response = await fetch(`${AUTH_API_URL}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(formData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to change password');
  }

  return data;
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

export async function requestAccountDeletion() {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/api/User/request-deletion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

export async function confirmAccountDeletion(data: { userId: string; token: string }) {
  const response = await fetch(`${API_BASE_URL}/api/User/confirm-deletion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
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
    try {
      if (data.data?.accessToken) localStorage.setItem('auth_token', data.data.accessToken);
      if (data.data?.refreshToken) localStorage.setItem('refresh_token', data.data.refreshToken);
    } catch (e) {
      console.warn('Could not persist tokens to localStorage', e);
    }
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
    try {
      if (data.data?.accessToken) localStorage.setItem('auth_token', data.data.accessToken);
      if (data.data?.refreshToken) localStorage.setItem('refresh_token', data.data.refreshToken);
    } catch (e) {
      console.warn('Could not persist tokens to localStorage', e);
    }
  }
  return data;
}
