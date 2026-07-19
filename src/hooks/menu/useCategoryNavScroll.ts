'use client';

// Horizontal-scroll state for the menu category nav (extracted so the shared
// CategoryNav and the craft CraftCategoryNav surface share ONE implementation
// — DRY, and the two never drift). Tracks whether the scroll container can
// scroll left/right (to show/hide the arrows) and exposes a smooth scroll(dir).
import { useRef, useState, useEffect } from 'react';

export interface CategoryNavScroll {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scroll: (direction: 'left' | 'right') => void;
}

const SCROLL_AMOUNT = 300;

/**
 * @param resetKey re-checks the arrows when this changes (e.g. the category
 * count) — the container's scrollWidth shifts as tabs mount.
 */
export function useCategoryNavScroll(resetKey: unknown): CategoryNavScroll {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const checkScrollButtons = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    };

    // Initial check after mount and whenever the reset key changes.
    const timer = setTimeout(checkScrollButtons, 100);
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        clearTimeout(timer);
        container.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
    return () => clearTimeout(timer);
  }, [resetKey]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const newScrollLeft = direction === 'left' ? el.scrollLeft - SCROLL_AMOUNT : el.scrollLeft + SCROLL_AMOUNT;
    el.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
  };

  return { scrollContainerRef, canScrollLeft, canScrollRight, scroll };
}
