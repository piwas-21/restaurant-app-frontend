'use client';

import { useRef, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

/**
 * `t`, reachable from inside an effect without becoming one of its dependencies.
 *
 * **The hazard this exists for is real-world-only, and a unit test will not show it.**
 * react-i18next memoises `t`, so its identity is stable across ordinary re-renders — which is
 * precisely what makes the bug easy to miss. The identity DOES change on `languageChanged`, and
 * the language switcher sits in the shared chrome on every screen. So an effect (or a `useCallback`
 * an effect depends on) that lists `t` re-runs when an admin or a customer switches language:
 *
 * - a paginated list refetches AT PAGE 1, losing the reader's place;
 * - a form-backed fetch resets whatever the user had typed;
 * - anything mid-checkout re-runs against a half-filled form.
 *
 * Reading `t` through this ref keeps the sentence current — the ref is reassigned every render, so
 * the next failure is worded in the new language — without making the fetch depend on the locale.
 *
 * **A single hoisted `const t = (k, f) => f ?? k` in a test models this WRONGLY.** It is stable in
 * both dimensions, so it certifies the buggy version. A test that means to cover a language switch
 * has to hold two distinct `t` functions and swap them (see `useCategoryManagement.test.ts`).
 *
 * Sibling hazard, same shape and worth knowing here because the fixes look alike: `useApiError`
 * returns a memoised OBJECT whose identity changes when its message changes. Putting THAT in the
 * deps of a callback an effect depends on gives capture → rebuild → refetch → fail → capture — an
 * unbounded retry against a backend that is already down. `capture` alone is `useCallback(…, [])`
 * and is safe; the object is not.
 */
export function useStableT(): MutableRefObject<TFunction> {
  const { t } = useTranslation();
  const ref = useRef(t);
  ref.current = t;
  return ref;
}
