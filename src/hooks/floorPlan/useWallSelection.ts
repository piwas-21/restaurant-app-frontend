'use client';

import { useCallback, useState } from 'react';
import { removeWall, updateWall } from '@/lib/floorPlan/document';
import type { FloorPlanDocument, FloorPlanWall } from '@/types/floorPlan';

interface WallSelectionArgs {
  /** The committed document — what a wall edit is applied to. */
  document: FloorPlanDocument;
  apply: (doc: FloorPlanDocument) => void;
  /** Drop the movable selection, so exactly one subject is ever live. */
  clearMovables: () => void;
}

/**
 * The wall selection (FLOOR-PLAN-REVAMP §4.3), kept apart from the movable one on
 * purpose. A table and a placed item share one geometry vocabulary
 * ({@link ../../lib/floorPlan/movable}) and can be selected together; a wall is a
 * polyline with a different panel and no footprint, so a mixed selection would
 * make the inspector ambiguous about what an edit acts on. Picking either side
 * therefore clears the other.
 *
 * Only the **id** is held here. The wall itself is resolved by the caller against
 * whatever it is rendering, because a wall vanishes under the selection on
 * delete, on undo, and on the save that re-mints every id — so a remembered
 * object would go stale where a remembered id simply stops resolving.
 */
export function useWallSelection({ document: doc, apply, clearMovables }: WallSelectionArgs) {
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);

  const selectWall = useCallback(
    (wallId: string) => {
      setSelectedWallId(wallId);
      clearMovables();
    },
    [clearMovables],
  );

  const clearWall = useCallback(() => setSelectedWallId(null), []);

  const patchWall = useCallback(
    (id: string, patch: Partial<FloorPlanWall>) => apply(updateWall(doc, id, patch)),
    [apply, doc],
  );

  const deleteWall = useCallback(
    (id: string) => {
      setSelectedWallId(null);
      apply(removeWall(doc, id));
    },
    [apply, doc],
  );

  return { selectedWallId, selectWall, clearWall, patchWall, deleteWall };
}
