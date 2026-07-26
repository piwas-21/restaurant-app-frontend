'use client';

import { useCallback, useState } from 'react';
import { removeWall, updateWall } from '@/lib/floorPlan/document';
import { canRemoveVertex, moveWallVertex, removeWallVertex } from '@/lib/floorPlan/wallEditing';
import { addWallOpening, removeWallOpening, updateWallOpening } from '@/lib/floorPlan/wallOpenings';
import { findWall } from '@/lib/floorPlan/wallHitTest';
import type { FloorPlanDocument, FloorPlanOpening, FloorPlanOpeningKind, FloorPlanWall } from '@/types/floorPlan';

interface WallSelectionArgs {
  /** The committed document — what a wall edit is applied to. */
  document: FloorPlanDocument;
  apply: (doc: FloorPlanDocument) => void;
  /** Drop the movable selection, so exactly one subject is ever live. */
  clearMovables: () => void;
}

/**
 * The wall selection and every edit that acts on it (FLOOR-PLAN-REVAMP §4.3),
 * kept apart from the movable selection on purpose. A table and a placed item
 * share one geometry vocabulary ({@link ../../lib/floorPlan/movable}) and can be
 * selected together; a wall is a polyline with a different panel and no
 * footprint, so a mixed selection would make the inspector ambiguous about what
 * an edit acts on. Picking either side therefore clears the other.
 *
 * Only **ids** (the wall's, and the picked corner's index) are held here. The
 * wall itself is resolved by the caller against whatever it is rendering, because
 * a wall vanishes under the selection on delete, on undo, and on the save that
 * re-mints every id — so a remembered object would go stale where a remembered id
 * simply stops resolving.
 */
export function useWallSelection({ document: doc, apply, clearMovables }: WallSelectionArgs) {
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);

  const selectWall = useCallback(
    (wallId: string) => {
      setSelectedWallId(wallId);
      // A different wall's corner numbering means nothing here.
      setSelectedVertex(null);
      clearMovables();
    },
    [clearMovables],
  );

  const clearWall = useCallback(() => {
    setSelectedWallId(null);
    setSelectedVertex(null);
  }, []);

  /** Apply a pure wall transform by id — the one write path for every edit below. */
  const mutate = useCallback(
    (id: string, change: (wall: FloorPlanWall) => FloorPlanWall) => {
      const wall = findWall(doc.walls, id);
      if (!wall) {
        return;
      }
      const next = change(wall);
      if (next !== wall) {
        apply(updateWall(doc, id, next));
      }
    },
    [apply, doc],
  );

  const patchWall = useCallback(
    (id: string, patch: Partial<FloorPlanWall>) => apply(updateWall(doc, id, patch)),
    [apply, doc],
  );

  const deleteWall = useCallback(
    (id: string) => {
      clearWall();
      apply(removeWall(doc, id));
    },
    [apply, clearWall, doc],
  );

  const moveVertex = useCallback(
    (id: string, index: number, x: number, y: number) => mutate(id, (wall) => moveWallVertex(wall, index, { x, y })),
    [mutate],
  );

  /**
   * Remove the picked corner. The selection moves to the previous corner rather
   * than clearing, so removing several in a row is a repeated keypress instead of
   * a re-aim each time.
   */
  const deleteVertex = useCallback(
    (id: string, index: number) => {
      const wall = findWall(doc.walls, id);
      if (!wall || !canRemoveVertex(wall)) {
        return;
      }
      setSelectedVertex(index > 0 ? index - 1 : null);
      apply(updateWall(doc, id, removeWallVertex(wall, index)));
    },
    [apply, doc],
  );

  const addOpening = useCallback(
    (id: string, segmentIndex: number, kind: FloorPlanOpeningKind) =>
      mutate(id, (wall) => addWallOpening(doc, wall, segmentIndex, kind)),
    [doc, mutate],
  );

  const patchOpening = useCallback(
    (id: string, openingId: string, patch: Partial<FloorPlanOpening>) =>
      mutate(id, (wall) => updateWallOpening(wall, openingId, patch)),
    [mutate],
  );

  const deleteOpening = useCallback(
    (id: string, openingId: string) => mutate(id, (wall) => removeWallOpening(wall, openingId)),
    [mutate],
  );

  return {
    selectedWallId,
    selectedVertex,
    selectVertex: setSelectedVertex,
    selectWall,
    clearWall,
    patchWall,
    deleteWall,
    moveVertex,
    deleteVertex,
    addOpening,
    patchOpening,
    deleteOpening,
  };
}
