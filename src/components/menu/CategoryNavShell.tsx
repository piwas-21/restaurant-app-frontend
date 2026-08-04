'use client';

// Shared category-nav shell: the sticky bar, the horizontal-scroll container,
// and the left/right scroll arrows. The tab BUTTONS are passed as children so
// each template skins them distinctly (classic rounded pills, craft masking-tape
// strips) with its own CSS module — only the shell structure + arrow behaviour
// live here, once. Each template passes its own module's classes via `styles`
// (both modules deliberately use the same shell class names).
import type { ReactNode, RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  canScrollBack: boolean;
  canScrollForward: boolean;
  scroll: (direction: 'back' | 'forward') => void;
  children: ReactNode;
}

export default function CategoryNavShell({
  styles,
  scrollContainerRef,
  showNavArrows,
  canScrollBack,
  canScrollForward,
  scroll,
  children,
}: Readonly<CategoryNavShellProps>) {
  const { t } = useTranslation();

  return (
    <nav className={styles.stickyNav} aria-label={t('category_navigation_aria', 'Category navigation')}>
      <div className={styles.navWrapper}>
        {/*
          `navArrowLeft`/`navArrowRight` stay PHYSICAL class names and that is correct: they are
          the arrow's position in the flex row, which the row already mirrors under `dir="rtl"`.
          What is logical is the direction of travel — `back`/`forward` — matching the aria-labels
          these buttons have always carried, and the chevron glyph that
          `[dir='rtl'] .navArrow svg { transform: scaleX(-1) }` already mirrors.
        */}
        {showNavArrows && canScrollBack && (
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={() => scroll('back')}
            aria-label={t('scroll_categories_back', 'Scroll categories back')}
            type="button"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <div ref={scrollContainerRef} className={styles.navScrollContainer}>
          <div className={styles.navButtonsContainer}>{children}</div>
        </div>

        {showNavArrows && canScrollForward && (
          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={() => scroll('forward')}
            aria-label={t('scroll_categories_forward', 'Scroll categories forward')}
            type="button"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </nav>
  );
}
