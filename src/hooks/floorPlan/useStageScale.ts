'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';

/**
 * Screen pixels per plan centimetre for the editor stage — the number that lets
 * on-canvas chrome hold a **constant screen size at any zoom** (FLOOR-PLAN-REVAMP
 * §4.4). Returns 0 until the stage has been measured, which callers read as
 * "nothing to size yet" rather than guessing a scale.
 */
export function useStageScale(stageRef: RefObject<HTMLElement | null>, viewBox: ViewBox, enabled = true): number {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !enabled) {
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height ? prev : { width: rect.width, height: rect.height },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      // Environments without ResizeObserver (jsdom, older browsers) still track
      // the stage, just at window granularity instead of element granularity.
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageRef, enabled]);

  // `preserveAspectRatio="xMidYMid meet"` fits with ONE uniform scale — the
  // smaller axis ratio — the same number `screenToPlanCm` inverts, so a grip
  // drawn through this lands exactly where the pointer projects back to.
  const scale = Math.min(size.width / viewBox.w, size.height / viewBox.h);
  return Number.isFinite(scale) && scale > 0 ? scale : 0;
}
