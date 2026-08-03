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
  /** `ApiError.errors` — the only place a thrown `apiClient` failure carries the per-rule list. */
  errors?: unknown;
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
 * The evidence a thrown `ApiError` carries. It has no `body`/`data`/`response`, so the envelope
 * checks below cannot see it — but the backend's reason is right there in `errors[]`.
 *
 * `errors[]` ONLY, deliberately. Promoting `message` here as well would also promote it above the
 * status gate, and that gate exists to refuse exactly this: a 400 covers every validation failure,
 * so a summary that happens to read "duplicate" for an unrelated reason would start matching. The
 * per-rule list carries one reason per entry and does not have that problem. `message` keeps its
 * old position at the tail.
 */
function thrownApiErrorSaysDuplicate(e: ThrownLikeError): boolean {
  return Array.isArray(e.errors) && matchesDuplicatePattern(e.errors);
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

  // `ApiError` — what `apiClient` throws — carries neither `body` nor `data` nor `response`, but
  // it DOES carry `errors`, and that is exactly where the backend puts this reason ("User with
  // this email already exists"; see `isDuplicateEmailResponse` above).
  //
  // Ahead of the status gate, not after it, and that ordering is the whole fix: an `ApiError` has
  // a status, so the gate below matches, finds no `body`, and RETURNS FALSE — correctly, since a
  // 400 alone proves nothing, but it would never have reached a check placed at the tail. Also
  // ahead of `message`, which on a validator failure is the summary ("Validation failed").
  //
  // Dormant today: `registerCustomer` is a raw `fetch` (`authService.ts`) that returns the parsed
  // body for every status, so this function sees the RESOLVED shape. The note that used to sit at
  // the tail called this "a future apiClient that doesn't attach a structured body" — that future
  // arrived with a KNOWN one, and matching on `message` alone would have missed it, because since
  // #401 a message-less `ApiError` gives `.test('')` → false.
  // Scoped to `!body` so every shape that HAS an envelope keeps its existing behaviour: the body
  // is authoritative, and a thrown error's own fields must not override it. Together with the
  // `errors`-only rule in the helper, this makes the change a STRICT ADDITION — measured against
  // the previous implementation, no input that returned `true` or `false` before changes answer;
  // only `{errors:[…duplicate…]}` with no body, which returned `false`, now returns `true`.
  if (!body && thrownApiErrorSaysDuplicate(e)) return true;

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
  if (typeof e.message === 'string') {
    return DUPLICATE_EMAIL_PATTERN.test(e.message);
  }
  return false;
}
