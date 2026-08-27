'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchGlobalIngredients, type GlobalIngredientSummary } from '@/services/globalIngredientService';

/** Two in-repo precedents agree on these numbers (`useSideItemSearch`), so this is not a third opinion. */
export const INGREDIENT_SUGGESTION_MIN_LENGTH = 2;
export const INGREDIENT_SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 5;

type ByRow<T> = Record<number, T>;

/**
 * The per-row type-ahead over the global ingredient library, extracted out of
 * `ProductIngredientsManager` (which is baselined and may only shrink).
 *
 * It also moves the call onto `apiClient`. The manager used to `fetch()` directly against
 * `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113'` — a hardcoded default port that is
 * not even the one `apiClient` uses (5221), so on a default dev setup the type-ahead silently
 * searched nothing. No auth header, no `ApiError`, no shared refresh-on-401 either.
 */
export function useGlobalIngredientSuggestions() {
  const [suggestions, setSuggestions] = useState<ByRow<GlobalIngredientSummary[]>>({});
  const [visible, setVisible] = useState<ByRow<boolean>>({});
  const [loading, setLoading] = useState<ByRow<boolean>>({});
  const timers = useRef<ByRow<ReturnType<typeof setTimeout>>>({});

  // Every pending debounce dies with the component; a timer that fires after unmount would set
  // state on nothing.
  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const runSearch = useCallback(async (query: string, index: number) => {
    setLoading((previous) => ({ ...previous, [index]: true }));
    try {
      const response = await searchGlobalIngredients(query, SUGGESTION_LIMIT);
      const items = response?.success ? (response.data ?? []) : [];
      setSuggestions((previous) => ({ ...previous, [index]: items }));
      setVisible((previous) => ({ ...previous, [index]: items.length > 0 }));
    } catch (error) {
      // A failed suggestion is not a failed edit: the admin can still type the name by hand, so
      // the UI stays silent rather than putting an error where a helper list should be. The reason
      // still goes to the console — which is what the code this replaced did (E9: the bare-catch
      // ratchet is about not DISCARDING the server's message, and a helper list has no user-facing
      // place to show one).
      console.error('Failed to fetch ingredient suggestions:', error);
      setSuggestions((previous) => ({ ...previous, [index]: [] }));
      setVisible((previous) => ({ ...previous, [index]: false }));
    } finally {
      setLoading((previous) => ({ ...previous, [index]: false }));
    }
  }, []);

  const search = useCallback(
    (index: number, query: string) => {
      clearTimeout(timers.current[index]);
      if (query.trim().length < INGREDIENT_SUGGESTION_MIN_LENGTH) {
        setSuggestions((previous) => ({ ...previous, [index]: [] }));
        setVisible((previous) => ({ ...previous, [index]: false }));
        return;
      }
      timers.current[index] = setTimeout(() => void runSearch(query, index), INGREDIENT_SUGGESTION_DEBOUNCE_MS);
    },
    [runSearch],
  );

  const setVisibleFor = useCallback((index: number, next: boolean) => {
    setVisible((previous) => ({ ...previous, [index]: next }));
  }, []);

  return { suggestions, visible, loading, search, setVisibleFor };
}

export default useGlobalIngredientSuggestions;
