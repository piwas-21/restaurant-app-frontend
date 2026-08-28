'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { VariationLibraryFilter } from '@/hooks/admin/useGlobalVariationLibrary';
// Shares the ingredient toolbar's stylesheet on purpose: the two pickers are the same modal over
// two catalogs, so a second copy of these rules would be a second thing to keep in step.
import styles from './GlobalIngredientPickerToolbar.module.css';

const FILTERS: VariationLibraryFilter[] = ['all', 'notAdded', 'translated'];
const FILTER_LABELS: Record<VariationLibraryFilter, string> = {
  all: 'variation_library_filter_all',
  notAdded: 'variation_library_filter_not_added',
  translated: 'variation_library_filter_translated',
};

/** Which half of the library is on screen. */
export type VariationLibraryView = 'active' | 'archived';

const VIEWS: VariationLibraryView[] = ['active', 'archived'];
const VIEW_LABELS: Record<VariationLibraryView, string> = {
  active: 'variation_library_view_active',
  archived: 'variation_library_view_archived',
};

interface GlobalVariationPickerToolbarProps {
  view: VariationLibraryView;
  onViewChange: (view: VariationLibraryView) => void;
  query: string;
  onQueryChange: (query: string) => void;
  filter: VariationLibraryFilter;
  onFilterChange: (filter: VariationLibraryFilter) => void;
}

/**
 * Everything above the list: the archive switch, the search box, the filter chips, and the two
 * column headers.
 *
 * A sibling of the ingredient toolbar rather than one component with a key prefix, because every
 * label here is a literal translation key and `scripts/check-t-keys.mjs` reads those statically —
 * a built key would take all twelve of them out of the gate's sight. The layout rules ARE shared,
 * through the stylesheet.
 *
 * The column strip is not decoration: the usage figure renders as a bare number to stay out of ten
 * sets of plural forms, so VARIATION / USAGE is what tells a sighted reader what the right column
 * counts; a screen reader gets the same words from each cell's `aria-label`.
 *
 * Search and the filters are hidden in the archived view — they are wired to the browsable list's
 * state, and leaving them on screen would offer to filter a list they do not touch.
 */
export default function GlobalVariationPickerToolbar({
  view,
  onViewChange,
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: Readonly<GlobalVariationPickerToolbarProps>) {
  const { t } = useTranslation();

  return (
    <>
      {/* fieldset+legend IS the grouping semantic — no role="group" needed (S6819). */}
      <fieldset className={styles.views}>
        <legend className="sr-only">{t('variation_library_view_label')}</legend>
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
              placeholder={t('variation_library_search_placeholder')}
              aria-label={t('variation_library_search_label')}
            />
          </div>

          {/* The legend names what is filtered; "All" would name it after one of its own options. */}
          <fieldset className={styles.filters}>
            <legend className="sr-only">{t('variation_library_filter_label')}</legend>
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

      {view === 'archived' && <p className={styles.hint}>{t('variation_library_archived_hint')}</p>}

      <div className={styles.columns}>
        <span>{t('variation_library_column_variation')}</span>
        <span>{t('variation_library_column_usage')}</span>
      </div>
    </>
  );
}
