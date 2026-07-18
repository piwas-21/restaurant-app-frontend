'use client';

// Shared category-nav shell: the sticky bar, the horizontal-scroll container,
// and the left/right scroll arrows. The tab BUTTONS are passed as children so
// each template skins them distinctly (classic rounded pills, craft masking-tape
// strips) with its own CSS module — only the shell structure + arrow behaviour
// live here, once. Each template passes its own module's classes via `styles`
// (both modules deliberately use the same shell class names).
import type { ReactNode, RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// The shell reads these class names off the passed CSS module (each template
// supplies its own): stickyNav, navWrapper, navScrollContainer,
// navButtonsContainer, navArrow, navArrowLeft, navArrowRight. Typed as the
// CSS-module shape (an index signature) since that's what a `*.module.css`
// import yields; both the classic and craft modules define every key.
export type CategoryNavShellStyles = Readonly<Record<string, string>>;

interface CategoryNavShellProps {
  styles: CategoryNavShellStyles;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  showNavArrows: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scroll: (direction: 'left' | 'right') => void;
  children: ReactNode;
}

export default function CategoryNavShell({
  styles,
  scrollContainerRef,
  showNavArrows,
  canScrollLeft,
  canScrollRight,
  scroll,
  children,
}: Readonly<CategoryNavShellProps>) {
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
            <ChevronLeft size={24} />
          </button>
        )}

        <div ref={scrollContainerRef} className={styles.navScrollContainer}>
          <div className={styles.navButtonsContainer}>{children}</div>
        </div>

        {showNavArrows && canScrollRight && (
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            type="button"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </nav>
  );
}
