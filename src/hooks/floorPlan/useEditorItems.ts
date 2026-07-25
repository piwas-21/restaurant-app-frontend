'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import { removeItems } from '@/lib/floorPlan/document';
import { canPlaceItem, duplicateItems, placeItem } from '@/lib/floorPlan/palette';
import { useStageProjection, type StagePointerHandlers } from './editorStage';
import type { FloorPlanDocument, FloorPlanPoint } from '@/types/floorPlan';

interface EditorItemsArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  snapEnabled: boolean;
  selectedIds: readonly string[];
  apply: (doc: FloorPlanDocument) => void;
  onSelectMany: (ids: string[]) => void;
  /** The next pointer layer (table/grip gestures, then marquee, then pan). */
  fallback: StagePointerHandlers;
}

/**
 * Placing and copying plan objects (FLOOR-PLAN-REVAMP §4.3). Arm a palette entry,
 * then click the canvas: the item lands centred on the click, grid-snapped and
 * plan-clamped. **Click-to-place is the SC 2.5.7 path** — it is how placement
 * works without a drag at all — so it is the primary interaction here rather than
 * a fallback for one.
 *
 * Placement is the **first link in the stage's pointer chain**: while armed, a
 * press places instead of grabbing, marqueeing or panning. It is deliberately
 * *single-shot* — one click places one object and returns you to selecting, with
 * the new object selected so the inspector is already pointing at it. Placing a
 * row of the same thing is ⌘D (`duplicateSelection`), which is faster than
 * re-aiming the same click anyway.
 *
 * Items live entirely in the local document until Save: the whole-document PUT
 * replaces walls and items wholesale, so unlike a table (whose identity, QR and
 * lifecycle belong to /api/tables) an item needs no API call to be born or die.
 */
export function useEditorItems({
  stageRef,
  viewBox,
  document: doc,
  snapEnabled,
  selectedIds,
  apply,
  onSelectMany,
  fallback,
}: EditorItemsArgs) {
  const [armedKind, setArmedKind] = useState<string | null>(null);
  /** Latched while a press has been consumed by placement, so its move/up are too. */
  const placing = useRef(false);
  const project = useStageProjection(stageRef, viewBox);

  const disarm = useCallback(() => setArmedKind(null), []);

  const placeAt = useCallback(
    (kind: string, point: FloorPlanPoint): boolean => {
      const placed = placeItem(doc, kind, point, { snapEnabled });
      if (!placed) {
        return false;
      }
      apply(placed.document);
      onSelectMany([placed.id]);
      return true;
    },
    [apply, doc, onSelectMany, snapEnabled],
  );

  /**
   * Pick a palette entry. Clicking the armed entry again disarms it — the palette
   * is a toggle. **A pointer-less activation places straight away**, at the middle
   * of the plan: a keyboard or assistive-tech user has no way to click the canvas,
   * so arming alone would leave them with no route to creating an object at all
   * (SC 2.1.1). From there the inspector and the arrow keys move it, exactly as
   * they move anything else.
   */
  const arm = useCallback(
    // No default: the caller always knows whether a pointer produced the
    // activation, and a silent default would be the untested path.
    (kind: string, viaPointer: boolean) => {
      if (!viaPointer) {
        placeAt(kind, { x: doc.widthMeters / 2, y: doc.heightMeters / 2 });
        return;
      }
      setArmedKind((current) => (current === kind ? null : kind));
    },
    [doc.heightMeters, doc.widthMeters, placeAt],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only the primary button places; a right-click must not drop an object.
      const places = Boolean(armedKind) && e.button === 0;
      // Assigned on EVERY press, not just a consumed one: a press that placed and
      // then released outside the window never sends us its pointer-up, and a
      // latched guard would swallow the next real gesture's whole sequence.
      placing.current = places;
      if (!places || !armedKind) {
        fallback.onPointerDown(e);
        return;
      }
      const projected = project(e.clientX, e.clientY);
      if (projected && placeAt(armedKind, projected.point)) {
        disarm();
      }
    },
    [armedKind, disarm, fallback, placeAt, project],
  );

  /**
   * A press consumed by placement owns its whole pointer sequence. Passing the
   * move/up on would hand the freshly placed object to the gesture layer, which
   * never saw the pointer-down and would read the drag as starting from wherever
   * the pointer happens to be now.
   */
  const guard = useCallback(
    (phase: keyof StagePointerHandlers, release: boolean) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (placing.current) {
        if (release) {
          placing.current = false;
        }
        return;
      }
      fallback[phase](e);
    },
    [fallback],
  );

  /**
   * Remove every selected item. The selection is left alone on purpose: the
   * store prunes ids that no longer exist, so a mixed selection keeps its table
   * (whose deletion is a confirmed /api/tables op) without this hook having to
   * know which ids survived.
   */
  const deleteSelectedItems = useCallback(() => {
    const next = removeItems(doc, selectedIds);
    if (next !== doc) {
      apply(next);
    }
  }, [apply, doc, selectedIds]);

  const duplicateSelection = useCallback(() => {
    const copies = duplicateItems(doc, selectedIds);
    if (copies.ids.length > 0) {
      apply(copies.document);
      onSelectMany(copies.ids);
    }
  }, [apply, doc, onSelectMany, selectedIds]);

  return {
    armedKind,
    arm,
    disarm,
    /** False once the plan is at the server's item cap — the palette says so. */
    canPlace: canPlaceItem(doc),
    handlers: {
      onPointerDown,
      onPointerMove: guard('onPointerMove', false),
      onPointerUp: guard('onPointerUp', true),
      onPointerCancel: guard('onPointerCancel', true),
    },
    deleteSelectedItems,
    duplicateSelection,
  };
}
