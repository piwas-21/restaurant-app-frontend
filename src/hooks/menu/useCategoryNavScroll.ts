'use client';

// Horizontal-scroll state for the menu category nav (extracted so the shared
// CategoryNav and the craft CraftCategoryNav surface share ONE implementation
// — DRY, and the two never drift). Tracks whether the scroll container can
// scroll toward the start/end (to show/hide the arrows) and exposes a smooth
// scroll(direction).
import { useRef, useState, useEffect } from 'react';

export interface CategoryNavScroll {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** There is content behind the current position — the "back" arrow is useful. */
  canScrollBack: boolean;
  /** There is content ahead of it — the "forward" arrow is useful. */
  canScrollForward: boolean;
  scroll: (direction: 'back' | 'forward') => void;
}

const SCROLL_AMOUNT = 300;

/**
 * How `scrollLeft` behaves, and why this file talks about back/forward rather than left/right.
 *
 * Per CSSOM-View — and in every browser this app ships to since Chrome 85 (2020) joined Firefox
 * and Safari — a horizontally scrolling element reports `scrollLeft === 0` at its **inline start**
 * in both writing directions. Under `dir="ltr"` it then grows POSITIVE toward the end; under
 * `dir="rtl"` it grows NEGATIVE. So the distance travelled from the start is `Math.abs(scrollLeft)`
 * either way, and the two ends become symmetric.
 *
 * **What the physical version did in `ar` (E8 slice 3).** This hook gated the back arrow on
 * `scrollLeft > 0`, which is `<= 0` throughout an RTL scroll, so the arrow **never appeared**; and
 * the forward arrow on `scrollLeft < scrollWidth - clientWidth - 1`, which a non-positive left-hand
 * side satisfies unconditionally, so it **always** appeared — including at the very end of the
 * list, where clicking it did nothing. Neither is visible under `dir="ltr"`, which is why the CSS
 * ratchet, jest, tsc, eslint and both screenshot legs all pass over it.
 *
 * The names are `back`/`forward` and not `left`/`right` because the buttons were already logical:
 * `CategoryNavShell` labels them `scroll_categories_back` / `scroll_categories_forward`, and the
 * chevron GLYPH is already mirrored by `[dir='rtl'] .navArrow svg { transform: scaleX(-1) }`. Only
 * the arithmetic was physical. Renaming rather than quietly fixing the sums is deliberate: it makes
 * every call site fail to compile until it has been looked at, which is the only mechanism this
 * repo has for a change no gate can see.
 */
export function useCategoryNavScroll(resetKey: unknown): CategoryNavScroll {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const checkScrollButtons = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const travelled = Math.abs(scrollLeft);
      const scrollable = scrollWidth - clientWidth;
      // The 1px tolerance on BOTH ends, not just the far one: a resting position is routinely a
      // fraction of a pixel off zero on a hi-dpi display, and `> 0` showed a back arrow that could
      // not move anything.
      setCanScrollBack(travelled > 1);
      setCanScrollForward(travelled < scrollable - 1);
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

  const scroll = (direction: 'back' | 'forward') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // `scrollBy` is NOT direction-aware — a positive `left` always moves the viewport rightwards.
    // Toward the inline END is rightwards in LTR and leftwards in RTL, so the sign has to come from
    // the element's computed direction. Reading it off the DOM rather than off `i18n.language`
    // keeps this correct for any future RTL locale without touching this file.
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const towardEnd = direction === 'forward';
    const magnitude = towardEnd === isRtl ? -SCROLL_AMOUNT : SCROLL_AMOUNT;
    el.scrollBy({ left: magnitude, behavior: 'smooth' });
  };

  return { scrollContainerRef, canScrollBack, canScrollForward, scroll };
}
