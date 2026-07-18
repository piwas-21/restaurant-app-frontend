'use client';

// Craft's menu category nav (S15 T4 surface slot): masking-tape tabs — a torn
// kraft strip per category tilted at slightly different hand-placed angles
// (Caveat), the active one terracotta. Same behaviour as the shared CategoryNav
// (order, ids, labels, the horizontal-scroll arrows) via the shared hooks; only
// the DOM/skin differ. Rendered only in the craft build (resolved via surfaceOr).
import type { CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CategoryNavProps } from '@/components/menu/CategoryNav';
import { useCategoryNavScroll } from '@/hooks/menu/useCategoryNavScroll';
import { useCategoryTabs } from '@/hooks/menu/useCategoryTabs';
import styles from './CraftCategoryNav.module.css';

// Hand-placed tilts, cycled per tab so the tape strips look stuck on by hand.
// A per-tab CSS custom property (a dynamic computed value — CLAUDE.md §5.6) so
// the CSS can compose the tilt with the hover-lift; no raw colours inline.
const TILTS = ['-2deg', '1.5deg', '-0.75deg', '2deg', '-1.25deg'];

export default function CraftCategoryNav({ categories, selectedView, onSelect, allLabel }: Readonly<CategoryNavProps>) {
  const tabs = useCategoryTabs(categories, allLabel);
  const { scrollContainerRef, canScrollLeft, canScrollRight, scroll } = useCategoryNavScroll(categories.length);

  // Show the scroll arrows only once the tabs can't all fit at once.
  const showNavArrows = tabs.length > 5;

  return (
    <nav className={styles.stickyNav} aria-label="Category Navigation">
      <div className={styles.navWrapper}>
        {showNavArrows && canScrollLeft && (
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            type="button"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        <div ref={scrollContainerRef} className={styles.navScrollContainer}>
          <div className={styles.navButtonsContainer}>
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tab} ${selectedView === tab.id ? styles.tabActive : ''}`}
                style={{ '--tab-tilt': TILTS[index % TILTS.length] } as CSSProperties}
                onClick={() => onSelect(tab.id)}
                aria-pressed={selectedView === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {showNavArrows && canScrollRight && (
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            type="button"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </nav>
  );
}
