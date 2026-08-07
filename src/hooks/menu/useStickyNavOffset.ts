'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTableContext } from '@/contexts/TableContext';

/** Height of the fixed site header, which both the table banner and the category nav stick below. */
const HEADER_HEIGHT = '80px';

/** Marks the sticky table banner so its height can be measured. Set by `TableBanner`. */
export const STICKY_BANNER_ATTR = 'data-sticky-banner';

/**
 * The menu page's sticky offsets, as a style object for the page root.
 *
 * `CategoryNav.module.css` used to hardcode `top: 130px` at both mobile breakpoints with the
 * comment "80px header + 50px TableBanner". Two things were wrong with that:
 *
 *  1. `TableBanner` renders `null` unless the guest arrived by scanning a table QR, so on every
 *     ordinary visit the page reserved space for a banner that was not there and the bar floated
 *     with an empty strip above it. That is the reported defect.
 *  2. The banner is not 50px. It measures 64px at 390px wide, and its height depends on its own
 *     padding, the font and how the table label wraps — so the number was going to drift again.
 *
 * Hence: the banner's height is MEASURED rather than asserted. Replacing one stale constant with a
 * fresher stale constant would reproduce the same bug a viewport away. `--menu-header-offset` is
 * published alongside it because the banner and the nav both stick below the header, and the
 * banner used to stick at `top: 0` — behind it — which left the reserved band empty even when the
 * banner did exist.
 */
export function useStickyNavOffset(): CSSProperties {
  const { hasTableContext } = useTableContext();
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    if (!hasTableContext) {
      setBannerHeight(0);
      return;
    }

    const el = document.querySelector(`[${STICKY_BANNER_ATTR}]`);
    if (!el) return;

    // `getBoundingClientRect`, not `contentRect`: the banner's padding is most of its height, and
    // the nav has to clear the border box.
    const measure = () => {
      const { height } = el.getBoundingClientRect();
      setBannerHeight((prev) => (prev === height ? prev : height));
    };
    measure();

    if (typeof ResizeObserver === 'undefined') {
      // jsdom and older browsers: still track the banner, at window granularity rather than
      // element granularity. Same fallback `hooks/floorPlan/useStageScale.ts` uses — without it
      // this throws inside a passive effect anywhere ResizeObserver is missing, which would make
      // the hook untestable and take any future MenuPage test down with it.
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasTableContext]);

  return useMemo(
    () =>
      ({
        '--menu-header-offset': HEADER_HEIGHT,
        '--menu-banner-offset': `${bannerHeight}px`,
      }) as CSSProperties,
    [bannerHeight],
  );
}
