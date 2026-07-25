'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { AlignmentGuide } from '@/lib/floorPlan/snapping';
import { gestureFromTarget, resolveGesture } from '@/lib/floorPlan/editorGestures';
import { applyGesture } from '@/lib/floorPlan/document';
import { toggleSelection } from '@/lib/floorPlan/selection';
import { findMovable, geometrySnapshot, sameGeometry } from '@/lib/floorPlan/movable';
import { alignToleranceMeters, itemGrabPadMeters, useStageProjection } from './editorStage';
import type { ActiveGesture, GestureSession, StagePointerHandlers } from './editorStage';
import type { FloorPlanDocument } from '@/types/floorPlan';

/**
 * How far a press must travel (screen pixels) before it edits: snapping quantises
 * absolutely, so without this a *tap* rounds an off-lattice value onto the lattice
 * and pushes a history entry nobody asked for. Touch tracks the platforms' own tap
 * slop (Android ~8dp, iOS ~10pt) — a finger drifts far more than a mouse.
 */
const dragThresholdPx = (pointerType: string): number => (pointerType === 'touch' ? 10 : 3);

interface EditorDragArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  snapEnabled: boolean;
  /** The whole selection: grips act on it, and a move carries all of it. */
  selectedIds: readonly string[];
  onSelect: (id: string, additive: boolean) => void;
  onCommit: (doc: FloorPlanDocument) => void;
  /** The next pointer layer (marquee, then pan/pinch) when nothing is grabbed. */
  fallback: StagePointerHandlers;
}

/**
 * Pointer gestures for the editor (FLOOR-PLAN-REVAMP §4.3). One pipeline, three
 * gestures: press a table or a placed item to **move** it, press the rotate grip
 * to **rotate**, press a resize grip to **resize** — all snapping through
 * {@link resolveGesture}. A move carries the whole selection. A gesture never
 * commits mid-move; the canvas renders `previewDoc` and exactly one History
 * entry is pushed on pointer-up, so an undo reverses the whole gesture. A press
 * that misses everything falls through to the marquee/pan layer. Every gesture
 * also has a no-drag equivalent in the inspector and on the keyboard (SC 2.5.7).
 */
export function useEditorDrag({
  stageRef,
  viewBox,
  document: doc,
  snapEnabled,
  selectedIds,
  onSelect,
  onCommit,
  fallback,
}: EditorDragArgs) {
  const active = useRef<GestureSession | null>(null);
  const previewRef = useRef<FloorPlanDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FloorPlanDocument | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [gesture, setGesture] = useState<ActiveGesture | null>(null);

  const project = useStageProjection(stageRef, viewBox);

  const reset = useCallback(() => {
    active.current = null;
    previewRef.current = null;
    setPreviewDoc(null);
    setGuides([]);
    setGesture(null);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const at = project(e.clientX, e.clientY);
      const pad = at ? itemGrabPadMeters(at.rect, viewBox) : 0;
      const next = at ? gestureFromTarget(e.target as Element, doc, selectedIds, at.point, pad) : null;
      const grabbed = next ? findMovable(doc, next.id) : null;
      if (!next || !grabbed) {
        fallback.onPointerDown(e);
        return;
      }
      // Pressing an object that is already part of a multi-selection must NOT
      // collapse the selection, or a group could never be dragged.
      const grouped = !e.shiftKey && selectedIds.length > 1 && selectedIds.includes(next.id);
      // `onSelect` is a setState, so `selectedIds` is still the PRE-press
      // selection for the rest of this handler. Derive what it is about to
      // become through the same pure function the store uses, or a move would
      // drag whatever happened to be selected before the press.
      const nextIds = grouped ? selectedIds : toggleSelection(selectedIds, next.id, e.shiftKey);
      if (!grouped) {
        onSelect(next.id, e.shiftKey);
      }
      if (!nextIds.includes(next.id)) {
        // A shift-press that DEselected the object under the cursor: that is the
        // whole interaction, not the start of a drag.
        return;
      }
      const origin = geometrySnapshot(grabbed);
      active.current = {
        gesture: next,
        origin,
        ids: nextIds,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        collapseTo: grouped ? next.id : null,
      };
      setGesture({ kind: next.kind, origin });
      stageRef.current?.setPointerCapture?.(e.pointerId);
    },
    [doc, project, viewBox, selectedIds, onSelect, stageRef, fallback],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const current = active.current;
      if (!current) {
        fallback.onPointerMove(e);
        return;
      }
      if (!current.moved) {
        if (Math.hypot(e.clientX - current.startX, e.clientY - current.startY) < dragThresholdPx(e.pointerType)) {
          return;
        }
        current.moved = true;
      }
      const projected = project(e.clientX, e.clientY);
      if (!projected) {
        return;
      }
      const result = resolveGesture(current.gesture, {
        document: doc,
        point: projected.point,
        modifiers: { alt: e.altKey, shift: e.shiftKey },
        snapEnabled,
        toleranceMeters: alignToleranceMeters(projected.rect, viewBox),
      });
      if (!result) {
        return;
      }
      const next = applyGesture(doc, current.gesture, result, current.ids);
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
    if (!current) {
      return;
    }
    if (!current.moved) {
      // A tap on one object of a group narrows the selection to it.
      if (current.collapseTo) {
        onSelect(current.collapseTo, false);
      }
      return;
    }
    const edited = pending ? findMovable(pending, current.gesture.id) : null;
    // Skip the history push when a gesture ended where it started (a wobble that
    // snapped back) so undo only reverses real edits.
    if (pending && edited && !sameGeometry(geometrySnapshot(edited), current.origin)) {
      onCommit(pending);
    }
  }, [onCommit, onSelect, reset]);

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
