'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { LibraryFilter } from '@/hooks/admin/useGlobalIngredientLibrary';
import styles from './GlobalIngredientPickerToolbar.module.css';

const FILTERS: LibraryFilter[] = ['all', 'notAdded', 'translated'];
const FILTER_LABELS: Record<LibraryFilter, string> = {
  all: 'ingredient_library_filter_all',
  notAdded: 'ingredient_library_filter_not_added',
  translated: 'ingredient_library_filter_translated',
};

/** Which half of the library is on screen. */
export type LibraryView = 'active' | 'archived';

const VIEWS: LibraryView[] = ['active', 'archived'];
const VIEW_LABELS: Record<LibraryView, string> = {
  active: 'ingredient_library_view_active',
  archived: 'ingredient_library_view_archived',
};

interface GlobalIngredientPickerToolbarProps {
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
  query: string;
  onQueryChange: (query: string) => void;
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
}

/**
 * Everything above the list: the archive switch, the search box, the filter chips, and the two
 * column headers the approved screen draws.
 *
 * The column strip is not decoration. Both figures in a row render as bare numbers to stay out of
 * ten sets of plural forms, so INGREDIENT / USAGE is what tells a sighted reader what the right
 * column counts; a screen reader gets the same words from each cell's `aria-label`.
 *
 * Search and the filters belong to the browsable catalog and are hidden in the archived view: they
 * are wired to that list's state, and leaving them on screen would offer to filter a list they do
 * not touch. The archived set is what is left over after a retirement, so it is short by nature.
 */
export default function GlobalIngredientPickerToolbar({
  view,
  onViewChange,
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: Readonly<GlobalIngredientPickerToolbarProps>) {
  const { t } = useTranslation();

  return (
    <>
      {/* fieldset+legend IS the grouping semantic — no role="group" needed (S6819). */}
      <fieldset className={styles.views}>
        <legend className="sr-only">{t('ingredient_library_view_label')}</legend>
        {VIEWS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={`${styles.viewTab} ${view === entry ? styles.viewTabActive : ''}`}
            aria-pressed={view === entry}
            onClick={() => onViewChange(entry)}
          >
            {t(VIEW_LABELS[entry])}
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
              placeholder={t('ingredient_library_search_placeholder')}
              aria-label={t('ingredient_library_search_label')}
            />
          </div>

          {/* The legend names what is filtered; "All" would name it after one of its own options. */}
          <fieldset className={styles.filters}>
            <legend className="sr-only">{t('ingredient_library_filter_label')}</legend>
            {FILTERS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={`${styles.chip} ${filter === entry ? styles.chipActive : ''}`}
                aria-pressed={filter === entry}
                onClick={() => onFilterChange(entry)}
              >
                {t(FILTER_LABELS[entry])}
              </button>
            ))}
          </fieldset>
        </>
      )}

      {view === 'archived' && <p className={styles.hint}>{t('ingredient_library_archived_hint')}</p>}

      <div className={styles.columns}>
        <span>{t('ingredient_library_column_ingredient')}</span>
        <span>{t('ingredient_library_column_usage')}</span>
      </div>
    </>
  );
}
