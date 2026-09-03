'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getGlobalVariations, type GlobalVariationSummary } from '@/services/globalVariationService';
import { admitsRow, MAX_VISIBLE_LIBRARY_ROWS } from '@/components/admin/product/libraryMatching';

/** Two chars before anything is offered, matching the ingredient type-ahead's own threshold. */
export const VARIATION_SUGGESTION_MIN_LENGTH = 2;
/** Five rows, as the ingredient one shows: a name field is not a browse surface. */
const SUGGESTION_LIMIT = 5;

/**
 * Type-ahead over the variation library for the editor's own **Variation name** input.
 *
 * The ingredient name field has had one since the library shipped; this side had none, so a size
 * already on the shelf — with its nine translations — could only be found by opening the picker, and
 * an admin who typed it instead got a second row saying the same word.
 *
 * **It reads the CATALOG, not a `/search` endpoint, and that is the difference that matters.** The
 * ingredient type-ahead calls `searchGlobalIngredients`, which matches `DefaultName` only — so a
 * French admin typing "grande" never finds "Large" however many translations it carries. This
 * filters the whole list with `admitsRow`, the same predicate the picker browses with, which folds
 * accents and searches every translation. The list is ~50 rows and is read ONCE per editor page, so
 * it also costs less than one request per keystroke; the ingredient catalog's 654 rows are why that
 * side went the other way (backend #431 records the trade).
 *
 * Both shelves are in it, because they are one list: a name the tenant created is offered beside a
 * name we shipped, which is what "search our library and the tenant's own" asks for.
 */
export function useVariationNameSuggestions(currentLanguage: string) {
  const [catalog, setCatalog] = useState<GlobalVariationSummary[]>([]);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  /** So a stale response cannot overwrite a fresher one, and none lands after unmount. */
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    // ONE read for the page. Not on the modal's schedule and not per keystroke: the catalog is the
    // same list the picker reads, and re-reading it for every character would be an order of
    // magnitude more traffic than the whole feature is worth.
    void getGlobalVariations()
      .then((response) => {
        if (alive.current && response?.success) setCatalog(response.data ?? []);
      })
      .catch((error) => {
        // A missing suggestion list is not a failed edit — the admin types the name either way — so
        // there is nowhere on screen to put a message. The reason still reaches the console, which
        // is what the ingredient type-ahead does for the same reason (E9).
        console.error('Failed to read the variation library for suggestions:', error);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  const search = useCallback((index: number, term: string) => {
    setQuery(term);
    setOpenRow(term.trim().length >= VARIATION_SUGGESTION_MIN_LENGTH ? index : null);
  }, []);

  const close = useCallback(() => setOpenRow(null), []);

  /**
   * What to offer for one row. Empty unless that row is the open one, so two rows can never show a
   * list at once — the input is single-caret and a second list would be describing a field nobody
   * is typing in.
   */
  const suggestionsFor = useCallback(
    (index: number, attachedIds: readonly (string | undefined)[]): GlobalVariationSummary[] => {
      if (openRow !== index) return [];
      const attached = new Set(attachedIds.filter(Boolean) as string[]);
      return (
        catalog
          .filter((row) =>
            admitsRow(row, {
              query,
              filter: 'all',
              attachedKeys: new Set<string>(),
              languageCode: currentLanguage,
              tenantOwnedOnly: false,
            }),
          )
          // A size already on this item is not a suggestion — picking it would add the word twice.
          .filter((row) => !attached.has(row.id))
          .slice(0, Math.min(SUGGESTION_LIMIT, MAX_VISIBLE_LIBRARY_ROWS))
      );
    },
    [catalog, currentLanguage, openRow, query],
  );

  return { search, close, suggestionsFor };
}

export default useVariationNameSuggestions;
