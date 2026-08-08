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
import { STICKY_NAV_ATTR } from '@/hooks/menu/useStickyNavOffset';

// The shell reads these class names off the passed CSS module (each template
// supplies its own): stickyNav, navWrapper, navScrollContainer,
// navButtonsContainer, navArrow, navArrowLeft, navArrowRight. Typed as the
// CSS-module shape (an index signature) since that's what a `*.module.css`
// import yields; both the classic and craft modules define every key.
export type CategoryNavShellStyles = Readonly<Record<string, string>>;

interface CategoryNavShellProps {
  styles: CategoryNavShellStyles;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /**
   * An EXTRA condition on top of the measured overflow, defaulting to none.
   *
   * `canScrollBack`/`canScrollForward` are the real answer — they come from the container's own
   * `scrollWidth`/`clientWidth`, which is what "there is more to scroll" means. Classic passes
   * nothing and rides on that alone. Craft still passes `tabs.length > 5`, a count that is not a
   * fit; removing it is a craft-track change, so the prop stays rather than disappearing.
   */
  showNavArrows?: boolean;
  canScrollBack: boolean;
  canScrollForward: boolean;
  scroll: (direction: 'back' | 'forward') => void;
  children: ReactNode;
}

export default function CategoryNavShell({
  styles,
  scrollContainerRef,
  showNavArrows = true,
  canScrollBack,
  canScrollForward,
  scroll,
  children,
}: Readonly<CategoryNavShellProps>) {
  const { t } = useTranslation();

  return (
    // The attribute, not a ref: `useStickyNavOffset` lives on the page and this shell is reached
    // through a template surface, so a ref would have to be threaded through both templates'
    // CategoryNav wrappers. Same mechanism `TableBanner` already uses for its own height.
    <nav
      className={styles.stickyNav}
      aria-label={t('category_navigation_aria', 'Category navigation')}
      {...{ [STICKY_NAV_ATTR]: '' }}
    >
      <div className={styles.navWrapper}>
        {/*
          `navArrowLeft`/`navArrowRight` stay PHYSICAL class names and that is still correct: they
          name the arrow's END of the bar, and each template's module is what pins that end so
          `dir="rtl"` swaps the two (classic with a logical inset, craft with its flex order).
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
