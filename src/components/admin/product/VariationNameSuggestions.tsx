'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GlobalVariationSummary } from '@/services/globalVariationService';
import styles from './ProductIngredientRow.module.css';

interface VariationNameSuggestionsProps {
  // readonly: S6759 — component props are never mutated.
  readonly rows: readonly GlobalVariationSummary[];
  readonly onPick: (row: GlobalVariationSummary) => void;
  /** The input's `aria-controls`, so the field and this list are one widget. */
  readonly listId: string;
  /** Names each row's element, so the input can point `aria-activedescendant` at one. */
  readonly optionId: (index: number) => string;
  /** Which row the arrow keys are on, or -1. */
  readonly activeIndex: number;
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
 *
 * **A flat `listbox` of BUTTONS carrying `role="option"`**, rather than the ingredient list's plain
 * buttons or a `ul` of `li` options. Focus never comes here: it stays in the input, which is a
 * `combobox` and names the highlighted row with `aria-activedescendant` — the only arrangement that
 * works, because Tab out of the input FIRES its blur and the blur closes the list, so a row reached
 * by tabbing could never exist. `tabIndex={-1}` keeps them out of the tab order accordingly. They
 * stay real buttons because a click handler belongs on something that is interactive without being
 * told it is (Sonar S1082), and `aria-selected` is what both the highlight and the screen reader
 * read.
 */
export default function VariationNameSuggestions({
  rows,
  onPick,
  listId,
  optionId,
  activeIndex,
}: VariationNameSuggestionsProps) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;

  return (
    <div className={styles.suggestions} id={listId} role="listbox" aria-label={t('variation_name')}>
      {rows.map((row, index) => (
        <button
          key={row.id}
          id={optionId(index)}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={index === activeIndex}
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
      ))}
    </div>
  );
}
