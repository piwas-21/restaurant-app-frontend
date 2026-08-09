'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import AllergenIcon from '@/components/common/AllergenIcon';
import { SPECIAL_FILTER_ID, type MenuFilterOption } from '@/hooks/menu/useMenuFilters';
import styles from './MenuFilters.module.css';

interface MenuFiltersProps {
  options: MenuFilterOption[];
  activeIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  /** How many dishes survive the active chips, and how many were loaded to filter. */
  shown: number;
  total: number;
}

/**
 * The dietary / allergen filter row under the category heading — `stitch_classic_restaurant_design_system`
 * puts it exactly there ("Vegetarian · Gluten-Free · Chef's Specials").
 *
 * Three chip families, and the difference between them is the whole point of the feature:
 *   - **Chef's Specials** — show only the promoted dishes.
 *   - **a dietary claim** ("Vegan") — show dishes that ARE that.
 *   - **an allergen** ("No gluten") — show dishes that are NOT. This is the one a guest with an
 *     allergy actually needs, and it is why the row cannot just be a list of the tags on the menu:
 *     a "Gluten" chip that showed gluten-containing dishes would be precisely backwards.
 *
 * Real `<button aria-pressed>`s, not checkboxes or links: they toggle a view, which is what
 * `aria-pressed` means, and it is the same pattern the category tabs on this page already use.
 */
export default function MenuFilters({
  options,
  activeIds,
  onToggle,
  onClear,
  shown,
  total,
}: Readonly<MenuFiltersProps>) {
  const { t } = useTranslation();

  if (options.length === 0) return null;

  const label = (option: MenuFilterOption) => {
    if (option.id === SPECIAL_FILTER_ID) return t('menu_filter_specials', "Chef's Specials");
    const allergen = t(`allergen_${option.token}`, option.token.replaceAll('_', ' '));
    return option.kind === 'without'
      ? t('menu_filter_without', { allergen, defaultValue: `No ${allergen}` })
      : allergen;
  };

  return (
    // A real <fieldset>/<legend>, not `role="group"` — these chips ARE controls, which is exactly
    // the case the native element exists for (typescript:S6819), and it is better supported by
    // assistive tech than the ARIA role. The legend is visually hidden because the row already sits
    // under the category heading and a second visible "Filter dishes" title would be noise; hiding
    // it is not the same as omitting it, which would leave the group unnamed.
    <fieldset className={styles.filters}>
      <legend className="sr-only">{t('menu_filters_label', 'Filter dishes')}</legend>
      <div className={styles.chipRow}>
        {options.map((option) => {
          const isActive = activeIds.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={isActive ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              aria-pressed={isActive}
              onClick={() => onToggle(option.id)}
            >
              {option.token && <AllergenIcon allergen={option.token} className={styles.chipIcon} />}
              <span>{label(option)}</span>
              {/* The survivor count, so a guest can see a chip is worth pressing before pressing it
                  — and so a chip that would empty the menu says `0` rather than looking broken. */}
              <span className={styles.chipCount}>{option.count}</span>
            </button>
          );
        })}
      </div>

      {activeIds.size > 0 && (
        <div className={styles.summary}>
          {/* "12 of 71 dishes" — `total` is what was LOADED and filtered, never the server's
              totalCount, so the sentence cannot claim a search it did not run. */}
          <span className={styles.count}>
            {t('menu_filters_count', { shown, total, defaultValue: `${shown} of ${total} dishes` })}
          </span>
          <button type="button" className={styles.clear} onClick={onClear}>
            <X className={styles.clearIcon} aria-hidden="true" />
            {t('menu_filters_clear', 'Clear filters')}
          </button>
        </div>
      )}
    </fieldset>
  );
}
