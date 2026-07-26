'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import { updateWall } from '@/lib/floorPlan/document';
import { insertWallVertex, moveWallVertex } from '@/lib/floorPlan/wallEditing';
import { snapDraftPoint, wallVertices } from '@/lib/floorPlan/wallDrafting';
import { alignToleranceMeters, useStageProjection, type StagePointerHandlers } from './editorStage';
import type { FloorPlanDocument, FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';

/** The DOM hooks the overlay's handles carry, read back on pointer-down. */
export const VERTEX_ATTR = 'data-wall-vertex';
export const MIDPOINT_ATTR = 'data-wall-midpoint';

interface WallVertexDragArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  /** The wall whose handles are on screen, or null when none is selected. */
  wall: FloorPlanWall | null;
  snapEnabled: boolean;
  apply: (doc: FloorPlanDocument) => void;
  /** Keep the inspector's vertex fields pointed at whatever is being dragged. */
  onSelectVertex: (index: number | null) => void;
  fallback: StagePointerHandlers;
}

/** The index parsed off a handle under the pointer, or null. */
function handleIndex(target: Element, attribute: string): number | null {
  const found = target.closest(`[${attribute}]`)?.getAttribute(attribute);
  const index = found === null || found === undefined ? Number.NaN : Number(found);
  return Number.isInteger(index) ? index : null;
}

/**
 * Dragging a wall's corners (FLOOR-PLAN-REVAMP §4.3). Grabbing a **corner dot**
 * moves that vertex; grabbing a **midpoint dot** inserts a corner there and drags
 * the new one straight away, which is the whole gesture for "this wall needs a
 * kink here" in one motion.
 *
 * The pointer path is an affordance, never the only one: the inspector edits the
 * selected corner's X/Y numerically and `Del` removes it (SC 2.5.7).
 *
 * Like the object gestures, nothing commits mid-drag — the canvas renders
 * `previewDoc` and exactly one History entry is pushed on pointer-up, so an undo
 * reverses the whole drag rather than the last frame of it.
 */
export function useWallVertexDrag({
  stageRef,
  viewBox,
  document: doc,
  wall,
  snapEnabled,
  apply,
  onSelectVertex,
  fallback,
}: WallVertexDragArgs) {
  /** The wall being reshaped and which of its corners; null when idle. */
  const session = useRef<{ wallId: string; index: number } | null>(null);
  const previewRef = useRef<FloorPlanDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FloorPlanDocument | null>(null);
  const project = useStageProjection(stageRef, viewBox);

  const reset = useCallback(() => {
    session.current = null;
    previewRef.current = null;
    setPreviewDoc(null);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const wallId = wall?.id;
      const target = e.target as Element;
      if (!wall || !wallId || e.button !== 0) {
        fallback.onPointerDown(e);
        return;
      }
      const vertex = handleIndex(target, VERTEX_ATTR);
      const midpoint = vertex === null ? handleIndex(target, MIDPOINT_ATTR) : null;
      if (vertex === null && midpoint === null) {
        fallback.onPointerDown(e);
        return;
      }
      const projected = project(e.clientX, e.clientY);
      if (!projected) {
        return;
      }
      // A midpoint grab becomes a corner grab: insert first, then drag the corner
      // that was just created — which is always the one after the split.
      const reshaped = midpoint === null ? wall : insertWallVertex(wall, midpoint, projected.point);
      const index = midpoint === null ? (vertex as number) : midpoint + 1;
      session.current = { wallId, index };
      onSelectVertex(index);
      if (reshaped !== wall) {
        const next = updateWall(doc, wallId, reshaped);
        previewRef.current = next;
        setPreviewDoc(next);
      }
      stageRef.current?.setPointerCapture?.(e.pointerId);
    },
    [doc, fallback, onSelectVertex, project, stageRef, wall],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const current = session.current;
      if (!current) {
        fallback.onPointerMove(e);
        return;
      }
      const projected = project(e.clientX, e.clientY);
      const base = previewRef.current ?? doc;
      const live = base.walls.find((w) => w.id === current.wallId);
      if (!projected || !live) {
        return;
      }
      // The corner being dragged is excluded from the endpoint candidates, or it
      // would snap to where it already is and never move.
      const others = wallVertices(base.walls.filter((w) => w.id !== current.wallId)).concat(
        live.points.filter((_, i) => i !== current.index),
      );
      const snap = snapDraftPoint(projected.point, {
        points: [],
        otherVertices: others,
        gridSizeCm: doc.gridSizeCm,
        snapEnabled,
        suspendSnap: e.altKey,
        freeAngle: true,
        toleranceMeters: alignToleranceMeters(projected.rect, viewBox),
      });
      const next = updateWall(base, current.wallId, moveWallVertex(live, current.index, snap.point));
      previewRef.current = next;
      setPreviewDoc(next);
    },
    [doc, fallback, project, snapEnabled, viewBox],
  );

  const settle = useCallback(() => {
    const pending = previewRef.current;
    reset();
    if (pending) {
      apply(pending);
    }
  }, [apply, reset]);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (session.current) {
        settle();
      } else {
        fallback.onPointerUp(e);
      }
    },
    [fallback, settle],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (session.current) {
        reset();
      } else {
        fallback.onPointerCancel(e);
      }
    },
    [fallback, reset],
  );

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    previewDoc,
  };
}

/** A vertex position, for the inspector's numeric fields. */
export const vertexAt = (wall: FloorPlanWall | null, index: number | null): FloorPlanPoint | null =>
  wall && index !== null ? (wall.points[index] ?? null) : null;
