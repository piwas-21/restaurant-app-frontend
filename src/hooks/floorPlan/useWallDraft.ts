'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import { addWall } from '@/lib/floorPlan/document';
import {
  draftWall,
  snapDraftPoint,
  wallVertices,
  MIN_DRAFT_VERTICES,
  type DraftSnap,
  type WallDraftState,
} from '@/lib/floorPlan/wallDrafting';
import { alignToleranceMeters, useStageProjection, type StagePointerHandlers } from './editorStage';
import { useWallDraftKeys } from './useWallDraftKeys';
import type { FloorPlanDocument, FloorPlanPoint } from '@/types/floorPlan';

export type { WallDraftState };

interface WallDraftArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  /** True while the Wall tool is the active tool; otherwise this layer is inert. */
  active: boolean;
  snapEnabled: boolean;
  apply: (doc: FloorPlanDocument) => void;
  /** Select the finished wall, so the inspector is already pointing at it. */
  onCreated: (wallId: string) => void;
  /** Back to the Select tool once a chain is finished or abandoned. */
  onDone: () => void;
  /** The next pointer layer (placement → gestures → marquee → pan). */
  fallback: StagePointerHandlers;
}

/**
 * The wall tool's drafting state machine (FLOOR-PLAN-REVAMP §4.3). **Click to
 * place a vertex; Enter or a double-click finishes the run; clicking the first
 * vertex again closes the chain into a room; Esc abandons it; Backspace takes the
 * last vertex back.** There is no drag in the whole interaction, which is what
 * makes it work identically with a mouse, a finger and a keyboard (SC 2.5.7).
 *
 * The draft lives here rather than in the document because an unfinished chain is
 * not a wall: committing each click would put half-drawn runs in the undo stack
 * and — briefly — in a save. Exactly one History entry is pushed, when the chain
 * finishes.
 */
export function useWallDraft({
  stageRef,
  viewBox,
  document: doc,
  active,
  snapEnabled,
  apply,
  onCreated,
  onDone,
  fallback,
}: WallDraftArgs) {
  const [points, setPoints] = useState<FloorPlanPoint[]>([]);
  const [cursor, setCursor] = useState<DraftSnap | null>(null);
  /** Latched while a press was handed to the pan layer, so its move/up go too. */
  const panning = useRef(false);
  const project = useStageProjection(stageRef, viewBox);

  const reset = useCallback(() => {
    setPoints([]);
    setCursor(null);
  }, []);

  /** Where the pointer's position lands once the snap rules have had it. */
  const snapAt = useCallback(
    (e: { clientX: number; clientY: number; altKey: boolean; shiftKey: boolean }) => {
      const projected = project(e.clientX, e.clientY);
      if (!projected) {
        return null;
      }
      return snapDraftPoint(projected.point, {
        points,
        otherVertices: wallVertices(doc.walls),
        gridSizeCm: doc.gridSizeCm,
        snapEnabled,
        suspendSnap: e.altKey,
        freeAngle: e.shiftKey,
        toleranceMeters: alignToleranceMeters(projected.rect, viewBox),
      });
    },
    [doc.gridSizeCm, doc.walls, points, project, snapEnabled, viewBox],
  );

  /**
   * Commit the chain. `closed` comes from how it ended — a click on the first
   * vertex closes it into a room, Enter / double-click leaves it an open run.
   * A chain too short to be either is simply dropped rather than saved as a dot.
   */
  const finish = useCallback(
    (chain: readonly FloorPlanPoint[], closed: boolean) => {
      reset();
      onDone();
      const wall = draftWall(doc, chain, closed);
      if (!wall?.id) {
        return;
      }
      apply(addWall(doc, wall));
      onCreated(wall.id);
    },
    [apply, doc, onCreated, onDone, reset],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // A non-primary press is a pan, and its whole sequence has to reach the
      // viewport — otherwise the pan would register its start and then never
      // move, leaving the admin unable to scroll the plan while drawing on it.
      // Assigned on EVERY press, so a released-off-window drag can't latch it.
      const deferred = !active || e.button !== 0;
      panning.current = deferred;
      if (deferred) {
        fallback.onPointerDown(e);
        return;
      }
      // The SECOND press of a double-click finishes the open run. Handling it
      // here rather than in an `onDoubleClick` is what stops that press placing a
      // duplicate vertex first — `dblclick` only fires after both clicks land.
      if (e.detail >= 2 && points.length >= MIN_DRAFT_VERTICES) {
        finish(points, false);
        return;
      }
      const snap = snapAt(e);
      if (!snap) {
        return;
      }
      if (snap.kind === 'close') {
        finish(points, true);
        return;
      }
      setPoints([...points, snap.point]);
      setCursor(snap);
    },
    [active, fallback, finish, points, snapAt],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!active || panning.current) {
        fallback.onPointerMove(e);
        return;
      }
      setCursor(snapAt(e));
    },
    [active, fallback, snapAt],
  );

  /** Release phases belong to the pan that claimed the press, or to nobody. */
  const release = useCallback(
    (phase: keyof StagePointerHandlers) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!active || panning.current) {
        panning.current = false;
        fallback[phase](e);
      }
    },
    [active, fallback],
  );

  useWallDraftKeys({
    active,
    points,
    finish: useCallback((chain: readonly FloorPlanPoint[]) => finish(chain, false), [finish]),
    cancel: useCallback(() => {
      reset();
      onDone();
    }, [onDone, reset]),
    undoVertex: useCallback(() => setPoints((current) => current.slice(0, -1)), []),
  });

  // Switching tools mid-chain must not leave a ghost draft to reappear later.
  useEffect(() => {
    if (!active) {
      reset();
    }
  }, [active, reset]);

  return {
    draft: active ? ({ points, cursor } satisfies WallDraftState) : null,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release('onPointerUp'),
      onPointerCancel: release('onPointerCancel'),
    },
  };
}
