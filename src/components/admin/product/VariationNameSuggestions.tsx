'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GlobalVariationSummary } from '@/services/globalVariationService';
import styles from './ProductIngredientRow.module.css';

interface VariationNameSuggestionsProps {
  // readonly: S6759 — component props are never mutated.
  readonly rows: readonly GlobalVariationSummary[];
  readonly onPick: (row: GlobalVariationSummary) => void;
}

/**
 * The library rows offered under a **Variation name** input as the admin types.
 *
 * The same list the ingredient name field has had since its library shipped, and it borrows that
 * field's stylesheet on purpose: the two tables sit in adjacent sections of one page and the screens
 * draw them identically, so a second copy of the same rules is a second thing to keep in step.
 *
 * What it offers is the CATALOG, both shelves at once — a size we shipped and a size this tenant
 * created are one list, which is what makes the offer worth reading. The count beside each name is
 * its translations, because that is what picking the row saves: the price is per product and the
 * catalog carries none.
 */
export default function VariationNameSuggestions({ rows, onPick }: VariationNameSuggestionsProps) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;

  return (
    <ul className={styles.suggestions}>
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className={styles.suggestionItem}
            // Keeps the input from blurring before the click is delivered — the same guard the
            // ingredient list needs, and for the same reason.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(row)}
          >
            <span>{row.defaultName}</span>
            <span className={styles.suggestionHint}>
              {t('variation_library_languages', { count: row.translations.length })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
