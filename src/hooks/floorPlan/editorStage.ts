'use client';

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { screenToPlanMetres, type ScreenRect, type ViewBox } from '@/lib/floorPlan/geometry';
import type { Gesture, GestureKind } from '@/lib/floorPlan/editorGestures';
import type { MovableGeometry } from '@/lib/floorPlan/movable';
import type { FloorPlanPoint } from '@/types/floorPlan';

/**
 * The editor stage's shared pointer plumbing (FLOOR-PLAN-REVAMP §4.3). Both
 * pointer layers — table/grip gestures and the marquee — project client
 * coordinates the same way and hand unclaimed events down the same chain, so
 * that projection lives here once instead of drifting between two hooks.
 */

/** Alignment guides appear/snap within this many screen pixels (§4.3). */
const ALIGN_THRESHOLD_PX = 6;

/**
 * How far outside its footprint a small item can still be grabbed. A 40 cm stool
 * is a handful of pixels on a fitted plan; the grip-sized 26 px would swallow its
 * neighbours, so this is a nudge rather than a target — the palette, inspector and
 * keyboard remain the pointer-free paths (SC 2.5.7).
 */
const ITEM_GRAB_PAD_PX = 6;

/** A screen-pixel distance as plan metres at the current zoom, or 0 before layout. */
function pxToMeters(px: number, rect: ScreenRect, viewBox: ViewBox): number {
  const pxPerCm = Math.min(rect.width / viewBox.w, rect.height / viewBox.h);
  return pxPerCm > 0 ? px / pxPerCm / 100 : 0;
}

/**
 * The alignment-snap tolerance in plan metres — a screen-pixel threshold taken
 * through the current zoom, so snapping feels identical fitted or zoomed in.
 */
export const alignToleranceMeters = (rect: ScreenRect, viewBox: ViewBox): number =>
  pxToMeters(ALIGN_THRESHOLD_PX, rect, viewBox);

/** The item grab tolerance in plan metres, likewise constant on screen. */
export const itemGrabPadMeters = (rect: ScreenRect, viewBox: ViewBox): number =>
  pxToMeters(ITEM_GRAB_PAD_PX, rect, viewBox);

/** One link in the stage's pointer chain; each layer defers to the next. */
export interface StagePointerHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/** The four phases every stage layer implements — one name, not four literals. */
export type StagePointerPhase = keyof StagePointerHandlers;

export interface StageProjection {
  rect: ScreenRect;
  point: FloorPlanPoint;
}

/** The live gesture as the overlay needs it: what is happening, and from where. */
export interface ActiveGesture {
  kind: GestureKind;
  origin: MovableGeometry;
}

/** A gesture in flight — everything pointer-up needs that the document doesn't hold. */
export interface GestureSession {
  gesture: Gesture;
  origin: MovableGeometry;
  /** The selection captured at pointer-down; a move carries all of it. */
  ids: readonly string[];
  startX: number;
  startY: number;
  /** Latches once the press clears the slop — a tap never edits. */
  moved: boolean;
  /**
   * Set when a press landed on an already-multi-selected table: a tap on one of
   * several collapses to it, but only once we know it was not a drag.
   */
  collapseTo: string | null;
}

/**
 * Project a pointer's client coordinates into plan metres, with the stage rect
 * it was measured against. Returns null before the stage is laid out, which
 * callers read as "no pointer geometry yet" rather than guessing an origin.
 */
export function useStageProjection(stageRef: RefObject<HTMLDivElement | null>, viewBox: ViewBox) {
  return useCallback(
    (clientX: number, clientY: number): StageProjection | null => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) {
        return null;
      }
      return { rect, point: screenToPlanMetres(clientX, clientY, viewBox, rect) };
    },
    [stageRef, viewBox],
  );
}
