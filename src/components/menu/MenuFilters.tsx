'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import AllergenIcon from '@/components/common/AllergenIcon';
import { useCategoryNavScroll } from '@/hooks/menu/useCategoryNavScroll';
import { SPECIAL_FILTER_ID, type MenuFilterOption } from '@/hooks/menu/useMenuFilters';
import styles from './MenuFilters.module.css';
// The one-row scroller and its arrows. Split from `MenuFilters.module.css` at the §4 ceiling, along
// the seam between what a chip LOOKS like and the mechanism that shows one row of them.
import rail from './MenuFilterRail.module.css';

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
 *
 * **Exactly one row, at every width.** It wrapped above 600px — the owner's 2026-08-09 review:
 * *"the allergens filters section better to be limited to one row properly to make it more user
 * friendly"*. A wrapped row is worse than it looks: the options are derived from the dishes on
 * screen, so their number is a property of the tenant's menu, and on a large one three rows of
 * chips pushed the first dish under the fold — which is the same defect the ≤600px rule had
 * already been written to fix, left unfixed on the viewport most guests browse on.
 *
 * The overflow affordance is `useCategoryNavScroll`, the SAME hook and the same measured-overflow
 * rule as the category bar directly above this row — not a chip count. Two rows of chips one under
 * the other that scrolled by different means would be the more confusing outcome, and that hook is
 * already correct for RTL, where `scrollLeft` runs negative (see its header).
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
  // Re-measures when the option SET changes — filtering rewrites the counts and can add or drop
  // chips, which changes whether the row overflows at all.
  const { scrollContainerRef, canScrollBack, canScrollForward, scroll } = useCategoryNavScroll(options.length);

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
      {/* The arrows render only on MEASURED overflow, so a menu whose filters fit shows a plain row
          and nothing else. They sit outside the scroller, not in it, or they would scroll away. */}
      <div className={rail.chipRail}>
        {canScrollBack && (
          <button
            type="button"
            // One class, not the `${railArrow} ${railArrowLeft}` pair `CategoryNavShell` uses:
            // there the side classes pin each arrow to an end of a positioned bar, and this rail is
            // a plain flex row where source order already does that. Copying the pair put two
            // undeclared names into a TEMPLATE LITERAL, which renders the string "undefined" into
            // the class attribute rather than being omitted the way a bare `{styles.x}` is.
            className={rail.railArrow}
            onClick={() => scroll('back')}
            aria-label={t('scroll_filters_back', 'Scroll filters back')}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        )}

        <div ref={scrollContainerRef} className={rail.chipScroller}>
          <div className={rail.chipRow}>
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
                  {/* The survivor count, so a guest can see a chip is worth pressing before pressing
                      it — and so a chip that would empty the menu says `0` rather than looking
                      broken. */}
                  <span className={styles.chipCount}>{option.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {canScrollForward && (
          <button
            type="button"
            className={rail.railArrow}
            onClick={() => scroll('forward')}
            aria-label={t('scroll_filters_forward', 'Scroll filters forward')}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        )}
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
