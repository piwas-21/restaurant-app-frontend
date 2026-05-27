/**
 * Duplicate-email detection helpers for the inline-registration flow.
 *
 * Extracted from `useInlineRegistration` so the detection logic can be
 * unit-tested in isolation (the hook itself transitively imports React
 * components that aren't trivially resolvable in jest).
 *
 * Issue #1 background: the backend (`RegisterCustomerCommand`) currently
 * returns HTTP 200 on a duplicate email with
 *   `{success: false, message: "Registration failed",
 *     errors: ["User with this email already exists"]}`
 * The previous implementation matched a substring against `message`, but
 * `message` is the generic "Registration failed" — so the duplicate branch
 * never fired in production. We now check `errors[]` as well, and also
 * handle the future case where a refactored `apiClient` throws on non-2xx.
 *
 * Backend follow-up (out of scope for #1): expose a machine-readable error
 * code (e.g. `code: "EmailAlreadyExists"`) so the frontend stops relying on
 * the English error string, which would silently break the day the backend
 * localises its errors.
 */

/**
 * Substring pattern used as the discriminator when no machine-readable
 * error code is available. Matches against the backend's English source
 * string only — this is safe today because the backend itself emits
 * English, but it will break if/when the backend localises.
 */
const DUPLICATE_EMAIL_PATTERN = /already.*exist|already.*registered|duplicate/i;

/**
 * HTTP statuses that conventionally signal "duplicate resource". 409 is
 * the canonical Conflict; 400 is what the backend would return today if
 * it stopped wrapping the failure in a 200. Accepted only as a
 * pre-condition — we still verify the body to avoid false positives on
 * unrelated 400s (e.g. validation failures).
 */
const DUPLICATE_HTTP_STATUSES = new Set([400, 409]);

export interface RegisterCustomerFailure {
  success?: boolean;
  message?: unknown;
  errors?: unknown;
}

interface ThrownLikeError {
  status?: unknown;
  statusCode?: unknown;
  response?: { status?: unknown; data?: unknown };
  data?: unknown;
  body?: unknown;
}

function matchesDuplicatePattern(value: unknown): boolean {
  if (typeof value === 'string') return DUPLICATE_EMAIL_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(matchesDuplicatePattern);
  return false;
}

/**
 * Returns true when the API response body indicates the email is already
 * registered. Checks both shapes the backend uses today:
 *   - `errors: ["User with this email already exists"]`   ← actual location
 *   - `message: "...already exists..."`                   ← forward-compat
 */
export function isDuplicateEmailResponse(result: RegisterCustomerFailure | null | undefined): boolean {
  if (!result || result.success) return false;
  return matchesDuplicatePattern(result.errors) || matchesDuplicatePattern(result.message);
}

/**
 * Returns true when a thrown error from `registerCustomer` indicates a
 * duplicate email. Robust to several common shapes: `{status, body}`,
 * `{statusCode, data}`, `{response: {status, data}}` (axios-like).
 *
 * Without a status, falls back to body-only inspection so an Error wrapper
 * carrying the parsed envelope still works.
 */
export function isDuplicateEmailError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as ThrownLikeError;
  const status = e.status ?? e.statusCode ?? e.response?.status;
  const body = e.body ?? e.data ?? e.response?.data;
  if (typeof status === 'number' && DUPLICATE_HTTP_STATUSES.has(status)) {
    if (body && typeof body === 'object') {
      return isDuplicateEmailResponse(body as RegisterCustomerFailure);
    }
    // Status alone is not sufficient (400 covers all validation errors).
    return false;
  }
  if (body && typeof body === 'object') {
    return isDuplicateEmailResponse(body as RegisterCustomerFailure);
  }
  return false;
}
