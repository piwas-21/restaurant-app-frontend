/**
 * Session Service
 *
 * Manages session IDs for anonymous users to track their baskets.
 * Session IDs are stored in localStorage and sent to the backend via X-Session-Id header.
 */

const SESSION_ID_KEY = 'rumi_session_id';
const SESSION_EXPIRY_KEY = 'rumi_session_expiry';
const SESSION_DURATION_DAYS = 7; // Session expires after 7 days

/**
 * Generate a new session id.
 *
 * **This has to be unguessable.** The id is the only thing identifying an anonymous
 * guest's basket to the backend (`X-Session-Id`), so anyone who can predict one can
 * read and modify that basket. The previous implementation built the UUID from
 * `Math.random()`, which is a seeded PRNG (xorshift128+ in V8) whose internal state
 * is recoverable from a handful of outputs — unguessable to a person, not to an
 * attacker. `crypto.getRandomValues` is the CSPRNG, and `crypto.randomUUID` is a
 * one-call v4 on top of it (Chrome 92+ / Firefox 95+ / Safari 15.4+, secure contexts).
 *
 * There is deliberately no `Math.random` fallback: silently degrading to a guessable
 * id is the bug being fixed. Web Crypto is available in every browser this app
 * supports, and `getSessionId`'s callers already handle a null session.
 */
function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Non-secure context (plain http): randomUUID is absent but getRandomValues is not.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Check if session has expired
 */
function isSessionExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return true;

  // The `try/catch` this replaced could not fire: `new Date(str)` does NOT throw on garbage, it
  // returns `Invalid Date`. So the catch's `return true` was unreachable and the LIVE path ran
  // `now >= Invalid Date`, which is a NaN comparison and therefore `false` — i.e. a corrupted or
  // tampered `rumi_session_expiry` read as NOT EXPIRED, and the 7-day window silently became
  // unbounded. Since the session id is the only thing authorising an anonymous guest's basket
  // (see this file's header), the unreadable case has to be checked explicitly, not caught.
  const expiry = new Date(expiryDate).getTime();
  return Number.isNaN(expiry) || Date.now() >= expiry;
}

/**
 * Calculate session expiry date
 */
function getSessionExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DURATION_DAYS);
  return expiry.toISOString();
}

/**
 * Get current session ID from localStorage
 * Returns null if session doesn't exist or has expired
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    const expiryDate = localStorage.getItem(SESSION_EXPIRY_KEY);

    // Check if session exists and hasn't expired
    if (sessionId && !isSessionExpired(expiryDate)) {
      return sessionId;
    }

    // Session expired or doesn't exist
    return null;
  } catch (error) {
    console.error('Error reading session ID from localStorage:', error);
    return null;
  }
}

/**
 * Create a new session ID and store it
 * Returns the newly created session ID
 */
export function createSessionId(): string {
  if (typeof window === 'undefined') {
    throw new Error('Cannot create session ID on server side');
  }

  try {
    const sessionId = generateUUID();
    const expiryDate = getSessionExpiry();

    localStorage.setItem(SESSION_ID_KEY, sessionId);
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryDate);

    return sessionId;
  } catch (error) {
    console.error('Error creating session ID:', error);
    throw new Error('Failed to create session ID');
  }
}

/**
 * Get or create session ID
 * Returns existing session if valid, otherwise creates a new one
 */
export function getOrCreateSessionId(): string {
  const existingSession = getSessionId();

  if (existingSession) {
    return existingSession;
  }

  return createSessionId();
}

/**
 * Clear session ID from localStorage
 * Used when user logs in (basket will be merged with user account)
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
  } catch (error) {
    console.error('Error clearing session ID:', error);
  }
}

/**
 * Refresh session expiry (extend session lifetime)
 * Call this on user activity to keep session alive
 */
export function refreshSessionExpiry(): void {
  if (typeof window === 'undefined') return;

  const sessionId = getSessionId();
  if (!sessionId) return;

  try {
    const newExpiryDate = getSessionExpiry();
    localStorage.setItem(SESSION_EXPIRY_KEY, newExpiryDate);
  } catch (error) {
    console.error('Error refreshing session expiry:', error);
  }
}

/**
 * Check if user has an active session
 */
export function hasActiveSession(): boolean {
  return getSessionId() !== null;
}

/**
 * Get session expiry date
 */
export function getSessionExpiryDate(): Date | null {
  if (typeof window === 'undefined') return null;

  try {
    const expiryDate = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (!expiryDate) return null;

    return new Date(expiryDate);
  } catch {
    // IGNORED ON PURPOSE: `localStorage` throws in private-browsing and blocked-storage modes.
    // "no expiry recorded" is the honest answer and every caller already handles `null`.
    return null;
  }
}

/**
 * Session service object with all methods
 */
export const sessionService = {
  getSessionId,
  createSessionId,
  getOrCreateSessionId,
  clearSessionId,
  refreshSessionExpiry,
  hasActiveSession,
  getSessionExpiryDate,
};
