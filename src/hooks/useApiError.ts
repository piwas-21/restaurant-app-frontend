'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formLevelMessage, routeApiError, type FieldMatchers, type RoutedApiError } from '@/utils/apiFormErrors';

export interface CaptureOptions<TField extends string> {
  /** Field routing table. Omit on a screen with no per-field errors to show. */
  readonly matchers?: FieldMatchers<TField>;
  /** Already-translated sentence for when the server authored none. */
  readonly fallback?: string;
}

export interface ApiErrorSurface<TField extends string> {
  /**
   * What to render. The server's own sentence when it authored one, the translated generic
   * otherwise, and `null` when there is nothing wrong.
   */
  readonly message: string | null;
  /** Per-field messages, for a form that renders them. Empty unless matchers were supplied. */
  readonly fieldErrors: RoutedApiError<TField>['fieldErrors'];
  /**
   * Route a failure. Returns the split, so a form can also apply `fieldErrors` to its inputs.
   *
   * `fallback` is the sentence for when the server authored none — pass one whenever the screen can
   * say something better than "an unexpected error occurred", which is most of them: "Failed to
   * load point rules" tells the user where they are. It must already be translated; omitting it
   * yields the translated generic. There is no way to reach an UNtranslated one.
   */
  readonly capture: (error: unknown, options?: CaptureOptions<TField>) => RoutedApiError<TField>;
  /** Show a message of our own — a client-side validation failure, typically. */
  readonly show: (message: string) => void;
  readonly clear: () => void;
}

/**
 * One error surface for a component: the state, the routing, and the translated fallback.
 *
 * `routeApiError` (E9 step 1) already does the hard part — it understands both failure shapes, and
 * it returns `rootMessage: null` rather than inventing prose when the server authored none. What it
 * cannot do is supply the sentence for that `null`, because it is not a component and has no `t`.
 * So every caller has to remember to write `routeApiError(e).rootMessage || t('…')`, and the whole
 * of E9 is the observation that callers do not remember.
 *
 * The evidence is in the helper the fix was built on: `getErrorMessage` ends
 * `return 'An unexpected error occurred';` — a hardcoded English literal, which is verbatim the
 * string the owner reported. The generic message was never the bug on its own; the bug is that it
 * is unavoidable, untranslated, and reached by forgetting rather than by deciding.
 *
 * That literal is now gone: `getErrorMessage` returns `null` when the server authored nothing, and
 * its callers each supply their own translated sentence. This hook and that helper close the same
 * hole from two ends — the hook for surfaces that hold their own error state, the null contract for
 * the bound catches the bare-catch ratchet cannot see.
 *
 * **What this guarantees, and what it does not.** The fallback cannot be untranslated: `message` is
 * computed from `t(...)` inside the hook, and the only way to influence it is a `fallback` that a
 * caller has already translated. That is narrow on purpose. Two ways to get it wrong survive, and
 * naming them is more useful than pretending they do not exist:
 *
 * - `show()` takes any string, so `show('Something went wrong')` compiles. It is for a sentence the
 *   caller has already translated; nothing enforces that.
 * - Calling `capture()` and never rendering `message` swallows the failure silently, and it type-checks.
 *   The forgetting moves from "supply a fallback" to "render the message" — smaller, but not gone.
 *   Worth a line on the step-3 checklist rather than a claim that it cannot happen.
 *
 * ```tsx
 * const err = useApiError<'email' | 'password'>();
 * try { await save(); } catch (e) { err.capture(e, MATCHERS); }
 * // …
 * {err.message && <p role="alert">{err.message}</p>}
 * ```
 */
export function useApiError<TField extends string = never>(): ApiErrorSurface<TField> {
  const { t } = useTranslation();
  const [routed, setRouted] = useState<{ result: RoutedApiError<TField>; fallback?: string } | null>(null);
  const [own, setOwn] = useState<string | null>(null);

  const capture = useCallback((error: unknown, options?: CaptureOptions<TField>) => {
    const result = routeApiError<TField>(error, options?.matchers);
    setOwn(null);
    setRouted({ result, fallback: options?.fallback });
    return result;
  }, []);

  const show = useCallback((message: string) => {
    setRouted(null);
    setOwn(message);
  }, []);

  const clear = useCallback(() => {
    setRouted(null);
    setOwn(null);
  }, []);

  const message = useMemo(() => {
    if (own !== null) return own;
    if (routed === null) return null;
    return formLevelMessage(routed.result, routed.fallback ?? t('unexpected_error', 'An unexpected error occurred'));
  }, [own, routed, t]);

  // Memoised as a whole, not just its callbacks: a fresh object every render makes
  // `useEffect(…, [err])` loop, and a hook meant to be dropped into ~100 call sites should not
  // carry a footgun that only shows up in the one that puts it in a dependency array.
  return useMemo(
    () => ({ message, fieldErrors: routed?.result.fieldErrors ?? [], capture, show, clear }),
    [message, routed, capture, show, clear],
  );
}

export default useApiError;
