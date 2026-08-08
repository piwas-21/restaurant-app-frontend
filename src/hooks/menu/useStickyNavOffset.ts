'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTableContext } from '@/contexts/TableContext';

/** Height of the fixed site header, which both the table banner and the category nav stick below. */
const HEADER_HEIGHT = '80px';

/** Marks the sticky table banner so its height can be measured. Set by `TableBanner`. */
export const STICKY_BANNER_ATTR = 'data-sticky-banner';

/** Marks the sticky category bar so its height can be measured. Set by `CategoryNavShell`. */
export const STICKY_NAV_ATTR = 'data-sticky-nav';

/**
 * Track one sticky element's border-box height, or 0 while it is absent.
 *
 * Extracted when the nav joined the banner — two copies of this would be two places to forget the
 * `ResizeObserver` fallback. `enabled` exists because the banner is conditionally rendered: without
 * it a stale height survives the element's removal and the page reserves a band for nothing, which
 * is the original defect this hook was written for.
 *
 * Two things make this more than "measure it once", and both were found by measuring rather than by
 * reading:
 *
 *  1. **The element need not exist yet, and the nav does not.** `MenuPage` returns `null` until it is
 *     both mounted and holding a selected view, so the effect's first pass runs against a document
 *     with no page in it. The banner never hit this because `hasTableContext` flipping re-runs its
 *     effect; the nav has no equivalent trigger, so a plain `if (!el) return` published `0px` forever
 *     and the rail's offset silently stayed at the value that had the bug.
 *  2. **The element is REPLACED, not resized.** Waiting for the nav and then handing it to a
 *     `ResizeObserver` still published a stale `45px` against a live nav of `66.8px`: React had swapped
 *     the node, leaving the observer on a detached one. Proven by forcing `padding-bottom: 40px` onto
 *     the live nav and watching the published variable not move.
 *
 * So the `MutationObserver` stays connected for the subtree's lifetime and re-attaches whenever the
 * matched node changes identity. That is a live watch rather than a one-shot, which costs one
 * `querySelector` per mutation batch — cheap next to publishing a wrong offset that nothing detects.
 */
function useStickyHeight(attr: string, enabled: boolean): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setHeight(0);
      return;
    }

    let tracked: Element | null = null;
    let detach: (() => void) | undefined;

    // `getBoundingClientRect`, not `contentRect`: the banner's padding is most of its height, and
    // whatever sticks below has to clear the border box.
    const measure = (el: Element) => {
      const { height: h } = el.getBoundingClientRect();
      setHeight((prev) => (prev === h ? prev : h));
    };

    const sync = () => {
      const el = document.querySelector(`[${attr}]`);
      if (el === tracked) return;

      detach?.();
      detach = undefined;
      tracked = el;

      if (!el) {
        // Gone rather than replaced: drop the reservation instead of leaving a band for nothing.
        setHeight(0);
        return;
      }

      measure(el);
      if (typeof ResizeObserver === 'undefined') {
        // jsdom and older browsers: still track the element, at window granularity rather than
        // element granularity. Same fallback `hooks/floorPlan/useStageScale.ts` uses — without it
        // this throws inside a passive effect anywhere ResizeObserver is missing, which would make
        // the hook untestable and take any future MenuPage test down with it.
        const onResize = () => measure(el);
        window.addEventListener('resize', onResize);
        detach = () => window.removeEventListener('resize', onResize);
        return;
      }
      const observer = new ResizeObserver(() => measure(el));
      // `border-box`, matching what `measure` reads. The default is `content-box`, which does not
      // change when padding or a border does — so a nav that grew only by padding would move the
      // element without ever notifying the observer, and the offset would drift silently.
      observer.observe(el, { box: 'border-box' });
      detach = () => observer.disconnect();
    };

    sync();

    if (typeof MutationObserver === 'undefined') {
      return () => detach?.();
    }
    const watcher = new MutationObserver(sync);
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => {
      watcher.disconnect();
      detach?.();
    };
  }, [attr, enabled]);

  return height;
}

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
 *
 * `--menu-nav-offset` is the same argument one layer down (S6). Since S11 made the category bar
 * page-wide chrome, it spans the basket rail too, and the rail's own `top: 1rem` cleared neither it
 * nor the header — measured at 1280px, the rail's top edge sat at y=55.4 with the nav's bottom at
 * 146.8, i.e. **91.3px** of the rail scrolled underneath. The nav's height is not a constant either:
 * it is 66.8px here because one seeded category carries an order-type sublabel, and it changes with
 * the tab set, the locale and the breakpoint. So it is measured, for the same reason the banner is.
 */
export function useStickyNavOffset(): CSSProperties {
  const { hasTableContext } = useTableContext();
  const bannerHeight = useStickyHeight(STICKY_BANNER_ATTR, hasTableContext);
  // Unconditional: the category bar is always rendered on this page.
  const navHeight = useStickyHeight(STICKY_NAV_ATTR, true);

  return useMemo(
    () =>
      ({
        '--menu-header-offset': HEADER_HEIGHT,
        '--menu-banner-offset': `${bannerHeight}px`,
        '--menu-nav-offset': `${navHeight}px`,
      }) as CSSProperties,
    [bannerHeight, navHeight],
  );
}
