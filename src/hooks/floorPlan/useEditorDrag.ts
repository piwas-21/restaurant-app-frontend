'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { screenToPlanMetres, type ViewBox } from '@/lib/floorPlan/geometry';
import type { AlignmentGuide } from '@/lib/floorPlan/snapping';
import { updateTable } from '@/lib/floorPlan/document';
import { gestureFromTarget, resolveGesture, type Gesture, type GestureKind } from '@/lib/floorPlan/editorGestures';
import { geometrySnapshot, sameGeometry, type TableGeometrySnapshot } from '@/lib/floorPlan/editorGeometry';
import type { FloorPlanDocument } from '@/types/floorPlan';

/** Alignment guides appear/snap within this many screen pixels (§4.3). */
const ALIGN_THRESHOLD_PX = 6;

/**
 * How far a press must travel (screen pixels) before it edits anything. Without
 * it a *tap* on a grip is an edit: snapping quantises absolutely, so the first
 * jittered move rounds an off-grid size or off-lattice angle onto the lattice and
 * pushes a history entry nobody asked for. The touch figure tracks the platforms'
 * own tap slop (Android ~8dp, iOS ~10pt) — a finger drifts far more than a mouse.
 */
const DRAG_THRESHOLD_PX = 3;
const TOUCH_DRAG_THRESHOLD_PX = 10;

/** The live gesture as the overlay needs it: what is happening, and from where. */
export interface ActiveGesture {
  kind: GestureKind;
  origin: TableGeometrySnapshot;
}

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
  /** Grips belong to the selection, so a grip press acts on this table. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCommit: (doc: FloorPlanDocument) => void;
  /** Empty-space pan/pinch handlers to defer to when nothing is grabbed. */
  fallback: StagePointerHandlers;
}

/**
 * Pointer gestures for the editor (FLOOR-PLAN-REVAMP §4.3). One pipeline, three
 * gestures: press a table to **move** it, press the rotate grip to **rotate**,
 * press a resize grip to **resize** — all snapping through
 * {@link resolveGesture}. A gesture never commits mid-move; the canvas renders
 * `previewDoc` and exactly one History entry is pushed on pointer-up, so an undo
 * reverses the whole gesture. A press that misses everything falls back to
 * pan / pinch. Every gesture also has a no-drag equivalent in the inspector and
 * on the keyboard (SC 2.5.7).
 */
export function useEditorDrag({
  stageRef,
  viewBox,
  document: doc,
  snapEnabled,
  selectedId,
  onSelect,
  onCommit,
  fallback,
}: EditorDragArgs) {
  const active = useRef<{
    gesture: Gesture;
    origin: TableGeometrySnapshot;
    startX: number;
    startY: number;
    /** Latches once the press clears {@link DRAG_THRESHOLD_PX} — a tap never edits. */
    moved: boolean;
  } | null>(null);
  const previewRef = useRef<FloorPlanDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FloorPlanDocument | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [gesture, setGesture] = useState<ActiveGesture | null>(null);

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

  const reset = useCallback(() => {
    active.current = null;
    previewRef.current = null;
    setPreviewDoc(null);
    setGuides([]);
    setGesture(null);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const projected = project(e.clientX, e.clientY);
      const next = projected ? gestureFromTarget(e.target as Element, doc, selectedId, projected.point) : null;
      const table = next ? doc.tables.find((tt) => tt.id === next.id) : undefined;
      if (!next || !table) {
        fallback.onPointerDown(e);
        return;
      }
      const origin = geometrySnapshot(table);
      active.current = { gesture: next, origin, startX: e.clientX, startY: e.clientY, moved: false };
      setGesture({ kind: next.kind, origin });
      onSelect(next.id);
      stageRef.current?.setPointerCapture?.(e.pointerId);
    },
    [doc, project, selectedId, onSelect, stageRef, fallback],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const current = active.current;
      if (!current) {
        fallback.onPointerMove(e);
        return;
      }
      if (!current.moved) {
        const slop = e.pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX;
        if (Math.hypot(e.clientX - current.startX, e.clientY - current.startY) < slop) {
          return;
        }
        current.moved = true;
      }
      const projected = project(e.clientX, e.clientY);
      if (!projected) {
        return;
      }
      const pxPerCm = Math.min(projected.rect.width / viewBox.w, projected.rect.height / viewBox.h);
      const result = resolveGesture(current.gesture, {
        document: doc,
        point: projected.point,
        modifiers: { alt: e.altKey, shift: e.shiftKey },
        snapEnabled,
        toleranceMeters: pxPerCm > 0 ? ALIGN_THRESHOLD_PX / pxPerCm / 100 : 0,
      });
      if (!result) {
        return;
      }
      const next = updateTable(doc, current.gesture.id, result.patch);
      previewRef.current = next;
      setPreviewDoc(next);
      setGuides(result.guides);
    },
    [doc, project, snapEnabled, viewBox, fallback],
  );

  const settle = useCallback(() => {
    const current = active.current;
    const pending = previewRef.current;
    reset();
    if (!current || !pending) {
      return;
    }
    const edited = pending.tables.find((t) => t.id === current.gesture.id);
    // Skip the history push when a gesture ended where it started (a click, or a
    // wobble that snapped back) so undo only reverses real edits.
    if (edited && !sameGeometry(geometrySnapshot(edited), current.origin)) {
      onCommit(pending);
    }
  }, [onCommit, reset]);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (active.current) {
        settle();
      } else {
        fallback.onPointerUp(e);
      }
    },
    [settle, fallback],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (active.current) {
        reset();
      } else {
        fallback.onPointerCancel(e);
      }
    },
    [reset, fallback],
  );

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    previewDoc,
    guides,
    gesture,
  };
}
