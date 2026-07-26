'use client';

import { useEffect } from 'react';
import { MIN_DRAFT_VERTICES } from '@/lib/floorPlan/wallDrafting';
import type { FloorPlanPoint } from '@/types/floorPlan';

interface WallDraftKeysArgs {
  active: boolean;
  points: readonly FloorPlanPoint[];
  /** Commit the chain as an open run. */
  finish: (chain: readonly FloorPlanPoint[]) => void;
  /** Abandon the chain and hand the tool back. */
  cancel: () => void;
  /** Take the last corner back. */
  undoVertex: () => void;
}

/**
 * The wall tool's keyboard controls (FLOOR-PLAN-REVAMP §4.3): **Enter** finishes
 * an open run, **Esc** abandons the chain, **Backspace** takes back the last
 * corner. These are what make the tool operable with no pointer at all, not
 * conveniences on top of one.
 *
 * Bound on the **capture phase** so Escape reaches the draft before the editor's
 * own window listener clears the selection — otherwise one Escape would do two
 * unrelated things, and the admin would lose their selection to abandoning a wall.
 */
export function useWallDraftKeys({ active, points, finish, cancel, undoVertex }: WallDraftKeysArgs) {
  useEffect(() => {
    if (!active) {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Enter' && points.length >= MIN_DRAFT_VERTICES) {
        e.preventDefault();
        e.stopPropagation();
        finish(points);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        cancel();
      } else if (e.key === 'Backspace' && points.length > 0) {
        e.preventDefault();
        undoVertex();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, cancel, finish, points, undoVertex]);
}
