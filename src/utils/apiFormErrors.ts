import { ApiError } from '@/utils/apiClient';
import type { ProblemFieldErrors } from '@/utils/problemDetails';

/**
 * Route one failed API call onto a form's fields.
 *
 * The problem this solves is structural, not cosmetic. `apiClient` **throws** `ApiError` for every
 * non-2xx, and a caller that writes `} catch {` (no binding) discards the entire diagnosis and
 * prints something like "An unexpected error occurred", which is what the owner saw when a staff
 * password was refused. The information was always on the wire; nothing read it.
 *
 * There were 100 such bare catches when this was written. This helper is the shape the rest of them
 * migrate to (BUGS-IMPROVEMENTS-PLAN E9) — so its edge cases matter more than one screen's worth:
 * a hole here is a hole in every migration that copies it.
 *
 * **Where a multi-entry `errors[]` comes from — corrected twice, now current as of backend #347.**
 * This header first said the per-rule messages arrive from `ValidationExceptionHandlingMiddleware`;
 * that was false (nothing threw FluentValidation's `ValidationException`, so the middleware was dead
 * and is now deleted). The correction said a validator failure arrives as a **single-element**
 * `errors[]`, joined with `"; "` into one `BadRequestException` blob — true until backend #291/#292
 * fixed exactly that. **A FluentValidation failure now arrives as one entry PER BROKEN RULE**, with
 * the joined sentence kept on `message`. So the per-field routing below finally gets what it was
 * designed for: a registration failing on password AND email files each under its own field instead
 * of the first matching pattern claiming the whole blob.
 *
 * Identity failures — duplicate email, a password refused by `StrongPasswordValidator`, an invalid
 * reset token — were always multi-entry and are unchanged. Both sources now look the same here.
 *
 * **The cost, and why `serverMessage` exists.** Anything reading only `errors[0]` used to see every
 * reason (they were one string) and now sees only the first. That is what `serverMessage` below is
 * for: it joins them back with the backend's own `"; "`. Reach for it whenever the destination is
 * ONE sentence a user reads; `serverMessages` is for when the parts are branched on separately.
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
  /** `ApiResponse.ErrorCode`, present only on `FailureWithCode` responses. */
  readonly errorCode?: string;
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
 * The server refused INSIDE a 200 — rethrow it as the shape everything else here reads.
 *
 * Handler failures come back wrapped in `Ok(ApiResponse.Failure(...))`, so they RESOLVE and never
 * become an `ApiError` on their own. Services used to turn that into
 * `throw new Error(response.message || '<English sentence>')`, which dropped `errors[]` — where
 * the backend actually puts the per-rule reason — and laundered a blank server message into a
 * client-authored one, the exact defect #401 removed from `apiClient` one layer down.
 *
 * **The status is 200, not 400**, and that is deliberate rather than lazy: 200 is what the
 * transport genuinely returned, and the refusal's own status is not recoverable at this point. An
 * invented 400 would read as an HTTP validation failure to `isValidationError` with no way to tell
 * the two apart; 200 cannot be mistaken for a transport failure by anything. Nothing branches on
 * it today — every caller reads the message.
 *
 * `errorCode` is forwarded too (#435). It used to be dropped, which made the recommended migration
 * off English substring matching — `ApiResponse.FailureWithCode` on the backend, `error.errorCode`
 * on the front — silently impossible for every refusal that arrives inside a 200: the branch would
 * compile, never fire, and fall through to the substring match that still happened to work, so the
 * dead branch stayed invisible until the backend localised its prose. `apiClient` already reads
 * `data.errorCode` on the thrown (non-2xx) path; this closes the same gap on the resolved one.
 */
export function throwServerRefusal(response: { message?: string; errors?: unknown; errorCode?: string }): never {
  throw new ApiError(
    200,
    response.message ?? '',
    Array.isArray(response.errors) ? response.errors : undefined,
    response.errorCode,
  );
}

/**
 * The SERVER's messages, most specific first, from whichever shape carries them — newest to
 * oldest: `errors[]` if present, else the summary `message`, else nothing.
 *
 * Exported for the callers that need the messages as a LIST rather than as one sentence. That used
 * to mean "four screens that branch on the FIRST one"; after frontend #490 it means the two that
 * inspect every entry separately — `customerDiscountForm` (matchers run per entry, so a reason in
 * position two is still recognised) and `reservationForm` (drops the `'Operation failed'` wrapper
 * and keeps the rest) — plus `serverMessage` below. **Nothing branches on `[0]` any more**, which
 * is the whole point of #490: the entries are per-rule now, so "the first one" is an arbitrary
 * rule, not a summary. `serverMessage` is the right call when the destination renders one string;
 * this is for when the parts genuinely have to be told apart.
 *
 * They each used to read `error.response.data.errors` — **an axios envelope this app has never
 * produced, because axios is not a dependency** — so every one of those branches was dead and the
 * screens fell through to their generic.
 *
 * **Why `errors[]` first.** On a controller's own `ApiResponse.Failure("<reason>")` — the common
 * refusal — the ONE-argument overload puts the reason in `Errors[0]` and leaves `Message` at its
 * default, the literal `"Operation failed"` (`ApiResponse.cs:55-63`). Reading `message` there
 * shows the guest a wrapper.
 *
 * **The Development-only cost, inherited not invented.** `ExceptionHandlingMiddleware` builds
 * `Failure(detail, message)` with `detail = IsDevelopment() ? exception.ToString() : message`, so
 * against a Development backend `errors[0]` is a stack trace. `getErrorMessage` has had exactly
 * this precedence tree-wide since E9 step 1, and `addToCartError` documents avoiding `errors` for
 * the same reason. Both deployed environments pin `Production` (`docker-compose.prod.yml`, the
 * tenant template), where `detail === message`.
 */
export function serverMessages(error: unknown): string[] {
  const detail = detailMessages(error);
  if (detail) return detail;
  const summary = serverAuthoredMessage(error);
  return summary ? [summary] : [];
}

/**
 * EVERY server reason as one sentence, or `null` when the server said nothing worth showing.
 *
 * This is the right call for the common case: a `setError`/`enqueueSnackbar`/`setFormError`
 * destination that renders ONE string. Use `serverMessages` only when the individual parts are
 * branched on (`routeApiError`'s per-field routing, `useLoginForm`'s verification check).
 *
 * **Why it exists (frontend #490).** Callers wrote `serverMessages(x)[0] ?? fallback`, which was
 * lossless while a validator failure was a single `"; "`-joined blob. Backend #291/#292 split that
 * into one entry per broken rule, so `[0]` silently became "show the first reason and drop the
 * rest" — the user fixes it, resubmits, and meets the next one. `CreateProductCommandValidator`
 * has 12 `RuleFor`s, so that is a real queue, not a hypothetical.
 *
 * **`'; '` and not `', '`** — deliberately the backend's own separator (`ValidationBehavior`'s
 * join, still what `message` carries), so these surfaces render the string they rendered before
 * #291 rather than a near-miss of it. `getErrorMessage` and `routeApiError` use `', '`; neither
 * regressed at #291 (both already joined every entry), so unifying the three is a cosmetic sweep
 * across five independent joiners and deliberately not done here.
 *
 * **Not `?? ''`**: `null` is what lets the caller's `?? t('...')` reach a TRANSLATED fallback. An
 * empty string is truthy-adjacent enough to have swallowed it (`''` would satisfy `??`).
 */
export function serverMessage(error: unknown): string | null {
  const messages = serverMessages(error);
  return messages.length > 0 ? messages.join('; ') : null;
}

/**
 * The FIELD-KEYED errors of an RFC 7807 refusal, or `null` when the failure was not one.
 *
 * The parsing itself happens once, in `apiClient` (see `utils/problemDetails.ts`); this is the
 * reader. Reach for it when a form can say something BETTER than the server's own sentence for a
 * particular field — a `DataAnnotation` message names a C# property to a guest ("The field
 * NumberOfGuests must be between 1 and 20."), and the `"$"` deserializer message quotes a .NET
 * type name. Everything else should keep using {@link serverMessage}: server prose is specific and
 * worth showing, these two shapes are the exception.
 */
export function problemFieldErrors(error: unknown): ProblemFieldErrors | null {
  return error instanceof ApiError ? (error.fieldErrors ?? null) : null;
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
  // `useMemberManagement` passes no matchers at all, so EVERY message lands here. (An earlier
  // version of this note justified the change with "a staff edit that trips six password rules was
  // one run-on paragraph" — measured, that request produced ONE message. A second version then
  // claimed a validator failure "cannot produce a multi-entry array at all", which was true of the
  // blob shape and is FALSE since backend #291: a six-rule failure is now six entries, and this
  // join is what puts the unmatched ones back on one line. Identity failures — several reasons for
  // one refused registration or password reset — were always multi-entry.)
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
