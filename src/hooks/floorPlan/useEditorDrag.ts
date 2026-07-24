'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { screenToPlanMetres, type ViewBox } from '@/lib/floorPlan/geometry';
import { alignmentSnap, snapToGrid, type AlignmentGuide } from '@/lib/floorPlan/snapping';
import { updateTable } from '@/lib/floorPlan/document';
import { clampCentreToPlan, otherTableRects, tableSnapRect } from '@/lib/floorPlan/editorGeometry';
import type { FloorPlanDocument } from '@/types/floorPlan';

/** Alignment guides appear/snap within this many screen pixels (§4.3). */
const ALIGN_THRESHOLD_PX = 6;

export interface StagePointerHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

interface EditorDragArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  snapEnabled: boolean;
  onSelect: (id: string) => void;
  onCommit: (doc: FloorPlanDocument) => void;
  /** Empty-space pan/pinch handlers to defer to when no table is grabbed. */
  fallback: StagePointerHandlers;
}

/**
 * Pointer move-drag for the editor (FLOOR-PLAN-REVAMP §4.3): grab a table and
 * drag it (mouse / touch / pen), snapping to the grid and to neighbours'
 * edges/centres with live guides. Snapping suspends while Alt is held. A drag
 * never commits mid-move — the canvas renders `previewDoc` and exactly one
 * History entry is pushed on pointer-up, so an undo reverses a whole move.
 * A pointerdown that misses every table falls back to pan / pinch.
 */
export function useEditorDrag({
  stageRef,
  viewBox,
  document: doc,
  snapEnabled,
  onSelect,
  onCommit,
  fallback,
}: EditorDragArgs) {
  const drag = useRef<{ id: string; grabX: number; grabY: number; origX: number; origY: number } | null>(null);
  const previewRef = useRef<FloorPlanDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FloorPlanDocument | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);

  const project = useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) {
        return null;
      }
      return { rect, point: screenToPlanMetres(clientX, clientY, viewBox, rect) };
    },
    [stageRef, viewBox],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const id = (e.target as Element).closest<SVGGElement>('[data-table-id]')?.dataset.tableId;
      const table = id ? doc.tables.find((tt) => tt.id === id) : undefined;
      const projected = table ? project(e.clientX, e.clientY) : null;
      if (table && projected) {
        drag.current = {
          id: table.id,
          grabX: table.positionX - projected.point.x,
          grabY: table.positionY - projected.point.y,
          origX: table.positionX,
          origY: table.positionY,
        };
        onSelect(table.id);
        stageRef.current?.setPointerCapture?.(e.pointerId);
      } else {
        fallback.onPointerDown(e);
      }
    },
    [doc.tables, project, onSelect, stageRef, fallback],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const active = drag.current;
      if (!active) {
        fallback.onPointerMove(e);
        return;
      }
      const projected = project(e.clientX, e.clientY);
      const table = doc.tables.find((tt) => tt.id === active.id);
      if (!projected || !table) {
        return;
      }
      let cx = projected.point.x + active.grabX;
      let cy = projected.point.y + active.grabY;
      let nextGuides: AlignmentGuide[] = [];
      if (!(e.altKey || !snapEnabled)) {
        cx = snapToGrid(cx, doc.gridSizeCm);
        cy = snapToGrid(cy, doc.gridSizeCm);
        const pxPerCm = Math.min(projected.rect.width / viewBox.w, projected.rect.height / viewBox.h);
        const tol = pxPerCm > 0 ? ALIGN_THRESHOLD_PX / pxPerCm / 100 : 0;
        const aligned = alignmentSnap(
          { ...tableSnapRect(table), x: cx, y: cy },
          otherTableRects(doc.tables, active.id),
          tol,
        );
        cx = aligned.x;
        cy = aligned.y;
        nextGuides = aligned.guides;
      }
      const centre = clampCentreToPlan(cx, cy, doc);
      const next = updateTable(doc, active.id, { positionX: centre.x, positionY: centre.y });
      previewRef.current = next;
      setPreviewDoc(next);
      setGuides(nextGuides);
    },
    [doc, project, snapEnabled, viewBox, fallback],
  );

  const settle = useCallback(() => {
    const active = drag.current;
    const pending = previewRef.current;
    drag.current = null;
    previewRef.current = null;
    setPreviewDoc(null);
    setGuides([]);
    if (pending && active) {
      const moved = pending.tables.find((t) => t.id === active.id);
      // Skip the history push when a drag ended where it started (a click, or a
      // wobble that snapped back) so undo only reverses real moves.
      if (moved && (moved.positionX !== active.origX || moved.positionY !== active.origY)) {
        onCommit(pending);
      }
    }
  }, [onCommit]);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (drag.current) {
        settle();
      } else {
        fallback.onPointerUp(e);
      }
    },
    [settle, fallback],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (drag.current) {
        drag.current = null;
        previewRef.current = null;
        setPreviewDoc(null);
        setGuides([]);
      } else {
        fallback.onPointerCancel(e);
      }
    },
    [fallback],
  );

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    previewDoc,
    guides,
    dragging: previewDoc !== null,
  };
}
