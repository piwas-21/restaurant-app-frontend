'use client';

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import { wallAtPoint } from '@/lib/floorPlan/wallHitTest';
import { alignToleranceMeters, useStageProjection, type StagePointerHandlers } from './editorStage';
import type { FloorPlanDocument } from '@/types/floorPlan';

interface WallPickArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  enabled: boolean;
  onPickWall: (wallId: string) => void;
  /** Bare plan: hand the press on to the marquee / pan layer. */
  fallback: StagePointerHandlers;
}

/**
 * Selecting a wall by pressing it (FLOOR-PLAN-REVAMP §4.3). This link sits
 * **below** the table/item gesture layer and **above** the marquee: an object on
 * top of a wall still wins the press, but a press on bare wall selects it instead
 * of starting a rubber band that would immediately deselect it.
 *
 * A wall is picked, never dragged. Moving a whole wall is not a §4.3 gesture —
 * its shape is edited vertex by vertex — so there is no session state here, and
 * the press is consumed on pointer-down with nothing to settle on pointer-up.
 */
export function useWallPick({ stageRef, viewBox, document: doc, enabled, onPickWall, fallback }: WallPickArgs) {
  const project = useStageProjection(stageRef, viewBox);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only a plain primary press picks: a right-click must not change the
      // selection, and shift is the objects' additive modifier, not a wall's
      // (a wall selection is always exactly one wall).
      const projected = enabled && e.button === 0 && !e.shiftKey ? project(e.clientX, e.clientY) : null;
      const hit = projected
        ? wallAtPoint(doc.walls, projected.point, alignToleranceMeters(projected.rect, viewBox))
        : null;
      if (!hit) {
        fallback.onPointerDown(e);
        return;
      }
      onPickWall(hit.wallId);
    },
    [doc.walls, enabled, fallback, onPickWall, project, viewBox],
  );

  return {
    handlers: {
      onPointerDown,
      onPointerMove: fallback.onPointerMove,
      onPointerUp: fallback.onPointerUp,
      onPointerCancel: fallback.onPointerCancel,
    },
  };
}
