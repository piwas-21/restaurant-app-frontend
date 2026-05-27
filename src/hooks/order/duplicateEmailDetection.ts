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
  message?: unknown;
}

/**
 * Max recursion depth when walking nested response objects. Prevents
 * runaway descent on cyclic structures (e.g. an error whose `cause`
 * points back at itself) while still covering the deepest realistic
 * shape we care about: ASP.NET Core's
 *   `{response: {data: {errors: {Email: ["..."]}}}}` (depth 4).
 */
const MAX_RECURSION_DEPTH = 5;

/**
 * Recursively walks `value` looking for any leaf string that matches
 * the duplicate-email pattern. Recurses into plain objects and arrays
 * only — never functions, class instances (Date, Map, Error subclasses
 * with extra junk, etc.), or primitives. The shape we explicitly need
 * to cover is ASP.NET Core's ModelState envelope:
 *   `{errors: {Email: ["User with this email already exists"]}}`
 * which the previous string/array-only walker would miss.
 */
function matchesDuplicatePattern(value: unknown, depth: number = 0): boolean {
  if (typeof value === 'string') return DUPLICATE_EMAIL_PATTERN.test(value);
  if (depth >= MAX_RECURSION_DEPTH) return false;
  if (Array.isArray(value)) return value.some((v) => matchesDuplicatePattern(v, depth + 1));
  if (isPlainObject(value)) {
    return Object.values(value).some((v) => matchesDuplicatePattern(v, depth + 1));
  }
  return false;
}

/**
 * Recurse only into plain objects (`{}` / `Object.create(null)`) — not
 * Date, Map, Set, Error, class instances, etc. Avoids surprising
 * traversal of host objects whose property access can throw.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
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
  // Last-ditch fallback: a thrown `Error("Email already registered")` from a
  // future apiClient that doesn't attach a structured body. We only reach
  // here when neither status+body nor body alone confirmed the duplicate,
  // so this is strictly additive.
  if (typeof e.message === 'string') {
    return DUPLICATE_EMAIL_PATTERN.test(e.message);
  }
  return false;
}
