import { ApiError } from '@/utils/apiClient';

/**
 * Route one failed API call onto a form's fields.
 *
 * The problem this solves is structural, not cosmetic. `apiClient` **throws** `ApiError` for every
 * non-2xx — including the 400 that `ValidationExceptionHandlingMiddleware` returns with the exact
 * per-rule messages in `errors[]`. A caller that writes `} catch {` (no binding) therefore discards
 * the entire diagnosis and prints something like "An unexpected error occurred", which is what the
 * owner saw when a staff password was refused. The information was always on the wire; nothing read
 * it.
 *
 * There were 103 such bare catches when this was written. This helper is the shape the rest of them
 * migrate to (BUGS-IMPROVEMENTS-PLAN E9) — so its edge cases matter more than one screen's worth:
 * a hole here is a hole in every migration that copies it.
 */

/**
 * Which field a server message belongs to. Ordered, first match wins, so put the narrow patterns
 * first. A message matching nothing goes to the form rather than being dropped — a message shown in
 * the wrong place is recoverable, a swallowed one is not.
 *
 * **Only list fields the calling form actually renders.** A message routed to a field with no input
 * on screen is written to state nobody displays, and because a routed message suppresses the
 * form-level one it goes out silently — the exact failure this helper exists to prevent. That is
 * why the two registration forms below have separate tables rather than sharing one.
 */
export type FieldMatchers<TField extends string> = ReadonlyArray<readonly [TField, RegExp]>;

export interface RoutedApiError<TField extends string> {
  /** One entry per server message that matched a field. */
  readonly fieldErrors: ReadonlyArray<{ readonly field: TField; readonly message: string }>;
  /**
   * Everything that matched no field. **`null` means "say something of your own"** — either there
   * was nothing left over, or what was left over is not fit to show a user. Callers must supply a
   * translated fallback with `||` (not `??`; see `presentable` below).
   */
  readonly rootMessage: string | null;
}

/**
 * A failure the API returned INSIDE a 200. Handler failures are wrapped in
 * `Ok(ApiResponse.Failure(...))`, so those resolve instead of throwing and never become an
 * `ApiError` — and `registerCustomer` does not use `apiClient` at all (`authService.ts` is a raw
 * `fetch` that returns the parsed body for every status), so on that path even a 400 arrives as
 * this shape. A caller handling only the thrown one silently drops most of its failure modes.
 */
interface ResolvedFailure {
  readonly success?: boolean;
  readonly message?: string;
  readonly errors?: unknown;
}

function asResolvedFailure(value: unknown): ResolvedFailure | null {
  if (typeof value !== 'object' || value === null || value instanceof ApiError) return null;
  const candidate = value as ResolvedFailure;
  return candidate.success === false ? candidate : null;
}

/** Non-blank text, or null. `''` and `'   '` are absence wearing a costume. */
function presentable(text: unknown): string | null {
  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

/**
 * The per-rule messages, from whichever shape carries them. `null` when there are none worth
 * showing. `Array.isArray` is load-bearing: a bare `.length` check also passes for a **string**,
 * and the loop below would then route it one character at a time.
 */
function detailMessages(error: unknown): string[] | null {
  const raw = error instanceof ApiError ? error.errors : asResolvedFailure(error)?.errors;
  if (!Array.isArray(raw)) return null;
  const usable = raw.map(presentable).filter((m): m is string => m !== null);
  return usable.length > 0 ? usable : null;
}

/**
 * Is this text the SERVER's, or something we invented on the client?
 *
 * The distinction decides who writes the sentence the user reads. Server prose
 * ("Password must contain at least one uppercase letter") is specific and worth showing untranslated.
 * A client-side throw is not: on the customer registration path the only things that reach a catch
 * are `TypeError` from a dead network and `SyntaxError` from `response.json()` when Caddy serves an
 * HTML 502 mid-deploy. Passing those through would put `Failed to fetch` or
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` in front of a customer — strictly worse
 * than the translated generic this whole change set out to replace.
 */
function serverAuthoredMessage(error: unknown): string | null {
  // Deliberately NOT `getErrorMessage`: that helper prefers `errors.join(', ')`, and we only reach
  // here when `detailMessages` found nothing usable in `errors` — so re-joining it hands back the
  // very blanks that were just filtered out (`['', '  ']` becomes `",   "`, which is text, renders
  // as a visible-but-empty error line, and defeats the whole `presentable` guard).
  if (error instanceof ApiError) return presentable(error.message);
  return presentable(asResolvedFailure(error)?.message);
}

/**
 * Split an unknown thrown (or resolved) failure into per-field and form-level messages.
 *
 * Messages are the SERVER's, verbatim and therefore in English. That is a deliberate trade against
 * a translated-but-generic string: "Password must contain at least one uppercase letter" tells the
 * user what to do and the generic one does not. The real fix for the language is upstream — the
 * mirrored `serverPasswordSchema` stops most of these being sent at all, so the untranslated path
 * is the exception rather than the norm. Anything the server did NOT author returns `null` so the
 * caller's own translated string wins.
 */
export function routeApiError<TField extends string>(
  error: unknown,
  matchers: FieldMatchers<TField> = [],
): RoutedApiError<TField> {
  const fieldErrors: Array<{ field: TField; message: string }> = [];
  const unmatched: string[] = [];

  // The only operator signal that exists. There is no browser Sentry (`instrumentation.ts` wires
  // server and edge only; the ingest origin would need a CSP change, a `CLAUDE.md` §9 refusal), so
  // without this a failure is visible ONLY to the person it happened to — which is exactly how the
  // bug this helper fixes was found: by a report, not by a log. Not a substitute for reporting;
  // it makes the failure reproducible from a user's devtools instead of from guesswork.
  console.error('[api-form-error]', error);

  const messages = detailMessages(error);

  if (!messages) {
    // No per-rule detail. Fall back to the summary line, but only if the server wrote it.
    return { fieldErrors: [], rootMessage: serverAuthoredMessage(error) };
  }

  for (const message of messages) {
    const match = matchers.find(([, pattern]) => pattern.test(message));
    if (match) {
      fieldErrors.push({ field: match[0], message });
    } else {
      unmatched.push(message);
    }
  }

  // `', '` and not `' '` — the same separator `getErrorMessage` uses, so the two helpers cannot
  // render one server's `errors[]` two different ways. It went unnoticed while every caller was a
  // FORM, where the leftovers are usually a single message and the separator never shows.
  // `useMemberManagement` passes no matchers at all, so EVERY message lands here: a staff edit that
  // trips six password rules was one run-on paragraph.
  return { fieldErrors, rootMessage: presentable(unmatched.join(', ')) };
}

/**
 * Shared matchers for the registration validators, which word their messages identically
 * (`Register{Staff,Customer}CommandValidator.cs`).
 *
 * `confirmPassword` is listed BEFORE `password` on purpose: "Passwords do not match" contains the
 * word "Password", so the broader pattern would otherwise claim it and pin a mismatch on the field
 * the user typed correctly.
 */
const SHARED_REGISTRATION_MATCHERS = [
  ['confirmPassword', /do not match|confirm password/i],
  ['password', /password/i],
  ['email', /e-?mail/i],
  ['firstName', /first name/i],
  ['lastName', /last name/i],
] as const;

/** Customer registration renders no role control — see the `FieldMatchers` note. */
export const CUSTOMER_REGISTRATION_MATCHERS = SHARED_REGISTRATION_MATCHERS satisfies FieldMatchers<
  'confirmPassword' | 'password' | 'email' | 'firstName' | 'lastName'
>;

/** Staff registration adds the role select, so `"Invalid role specified"` has somewhere to land. */
export const STAFF_REGISTRATION_MATCHERS = [
  ...SHARED_REGISTRATION_MATCHERS,
  ['role', /role/i],
] as const satisfies FieldMatchers<'confirmPassword' | 'password' | 'email' | 'firstName' | 'lastName' | 'role'>;

/**
 * The form-level message for a routed failure, or `null` when there should not be one.
 *
 * `rootMessage: null` means two different things and the difference decides whether a second error
 * line appears. Every message having been routed to a FIELD is not an absence of information — it
 * is the best case, and printing "An unexpected error occurred" underneath "Password must contain
 * at least one uppercase letter" is exactly the noise E9 is about. The generic belongs to the case
 * where nothing at all could be said.
 *
 * Extracted because three screens need this decision and no two of them can share state:
 * `RegisterStaffModal` holds its errors in react-hook-form's `setError`, `useRegisterForm` in its
 * own `useState`, and `useApiError` in the hook's. The state differs; the rule must not.
 */
export function formLevelMessage<TField extends string>(
  routed: RoutedApiError<TField>,
  translatedFallback: string,
): string | null {
  if (routed.rootMessage) return routed.rootMessage;
  return routed.fieldErrors.length > 0 ? null : translatedFallback;
}
