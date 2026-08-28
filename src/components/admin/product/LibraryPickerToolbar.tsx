'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { LibraryFilter } from '@/hooks/admin/useLibraryCatalog';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import styles from './GlobalIngredientPickerToolbar.module.css';

/** Which half of the library is on screen. */
export type LibraryPickerView = 'active' | 'archived';

const FILTERS: LibraryFilter[] = ['all', 'notAdded', 'translated'];
const FILTER_SLOTS: Record<LibraryFilter, keyof LibraryPickerCopy> = {
  all: 'filterAll',
  notAdded: 'filterNotAdded',
  translated: 'filterTranslated',
};

const VIEWS: LibraryPickerView[] = ['active', 'archived'];
const VIEW_SLOTS: Record<LibraryPickerView, keyof LibraryPickerCopy> = {
  active: 'viewActive',
  archived: 'viewArchived',
};

interface LibraryPickerToolbarProps {
  /** Which catalog's words to render — the only thing that differs between the two pickers. */
  copy: LibraryPickerCopy;
  view: LibraryPickerView;
  onViewChange: (view: LibraryPickerView) => void;
  query: string;
  onQueryChange: (query: string) => void;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
}

/**
 * Everything above the list: the archive switch, the search box, the filter chips, and the two
 * column headers the approved screen draws.
 *
 * One toolbar for both catalogs. It was written twice first — the ingredient one for plan S2, the
 * variation one for S4 — on the argument that a literal `t('…')` at every label keeps each key in
 * `scripts/check-t-keys.mjs`'s sight. The copy came out of it into `libraryPickerCopy`, where the
 * keys are still literals and both catalogs are one table apart; twelve labels was not worth a
 * second copy of the layout.
 *
 * The column strip is not decoration. Both figures in a row render as bare numbers to stay out of
 * ten sets of plural forms, so INGREDIENT|VARIATION / USAGE is what tells a sighted reader what the
 * right column counts; a screen reader gets the same words from each cell's `aria-label`.
 *
 * Search and the filters belong to the browsable catalog and are hidden in the archived view: they
 * are wired to that list's state, and leaving them on screen would offer to filter a list they do
 * not touch.
 */
export default function LibraryPickerToolbar({
  copy,
  view,
  onViewChange,
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: Readonly<LibraryPickerToolbarProps>) {
  const { t } = useTranslation();

  return (
    <>
      {/* fieldset+legend IS the grouping semantic — no role="group" needed (S6819). */}
      <fieldset className={styles.views}>
        <legend className="sr-only">{t(copy.viewLabel)}</legend>
        {VIEWS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={`${styles.viewTab} ${view === entry ? styles.viewTabActive : ''}`}
            aria-pressed={view === entry}
            onClick={() => onViewChange(entry)}
          >
            {t(copy[VIEW_SLOTS[entry]])}
          </button>
        ))}
      </fieldset>

      {view === 'active' && (
        <>
          <div className={styles.searchRow}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t(copy.searchPlaceholder)}
              aria-label={t(copy.searchLabel)}
            />
          </div>

          {/* The legend names what is filtered; "All" would name it after one of its own options. */}
          <fieldset className={styles.filters}>
            <legend className="sr-only">{t(copy.filterLabel)}</legend>
            {FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={`${styles.chip} ${filter === entry ? styles.chipActive : ''}`}
                aria-pressed={filter === entry}
                onClick={() => onFilterChange(entry)}
              >
                {t(copy[FILTER_SLOTS[entry]])}
              </button>
            ))}
          </fieldset>
        </>
      )}

      {view === 'archived' && <p className={styles.hint}>{t(copy.archivedHint)}</p>}

      <div className={styles.columns}>
        <span>{t(copy.columnEntity)}</span>
        <span>{t(copy.columnUsage)}</span>
      </div>
    </>
  );
}
