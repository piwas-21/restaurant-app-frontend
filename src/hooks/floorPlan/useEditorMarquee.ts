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
import { idsInMarquee, marqueeBetween, type MarqueeRect } from '@/lib/floorPlan/selection';
import { documentMovables } from '@/lib/floorPlan/movable';
import { useStageProjection, type StagePointerHandlers } from './editorStage';
import type { FloorPlanDocument, FloorPlanPoint } from '@/types/floorPlan';

/**
 * A press that travels less than this many screen pixels is a click, not a
 * sweep — the same slop the gesture layer uses, so the two agree at any zoom.
 */
const SWEEP_THRESHOLD_PX = 3;

interface EditorMarqueeArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  enabled: boolean;
  selectedIds: readonly string[];
  onSelectMany: (ids: string[]) => void;
  /** Pan / pinch, for touch and for a space-held drag. */
  fallback: StagePointerHandlers;
}

/**
 * The empty-space pointer layer (FLOOR-PLAN-REVAMP §4.3). Dragging bare plan with
 * a mouse or pen sweeps a **marquee**; `Shift` adds the sweep to the current
 * selection instead of replacing it, and a click that never sweeps clears the
 * selection.
 *
 * **Touch and space-held drags still pan.** A finger has no second button to
 * reserve for panning, and §4.2's stated pan gesture is space-drag, so those two
 * cases go straight to the viewport. Marquee is never the only way to select
 * several tables — shift-click is the no-drag equivalent (SC 2.5.7).
 */
export function useEditorMarquee({
  stageRef,
  viewBox,
  document: doc,
  enabled,
  selectedIds,
  onSelectMany,
  fallback,
}: EditorMarqueeArgs) {
  const origin = useRef<{ point: FloorPlanPoint; additive: boolean; startX: number; startY: number } | null>(null);
  const [band, setBand] = useState<MarqueeRect | null>(null);
  // React batches `pointermove` at continuous priority, so a fast flick delivers
  // `pointerup` before the band state has flushed. The ref is what settle reads.
  const bandRef = useRef<MarqueeRect | null>(null);
  const spaceHeld = useRef(false);
  const project = useStageProjection(stageRef, viewBox);

  const showBand = useCallback((next: MarqueeRect | null) => {
    bandRef.current = next;
    setBand(next);
  }, []);

  // Space-drag pans (§4.2). Tracked on the window so the stage needs no focus.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = e.type === 'keydown';
      }
    };
    // Releasing Space after alt-tabbing never reaches us, which would latch the
    // marquee off for good; losing focus is the cue to forget the key is down.
    const onBlur = () => {
      spaceHeld.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only the primary button sweeps. That is exactly why middle-drag is the
      // conventional pan in every editor — and it gives mouse users their pan
      // back, alongside space-drag. A right-click must never clear a selection.
      const sweeps = e.button === 0 && e.pointerType !== 'touch' && !spaceHeld.current;
      const projected = sweeps ? project(e.clientX, e.clientY) : null;
      if (!projected) {
        fallback.onPointerDown(e);
        return;
      }
      origin.current = { point: projected.point, additive: e.shiftKey, startX: e.clientX, startY: e.clientY };
      stageRef.current?.setPointerCapture?.(e.pointerId);
    },
    [project, stageRef, fallback],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const start = origin.current;
      if (!start) {
        fallback.onPointerMove(e);
        return;
      }
      if (Math.hypot(e.clientX - start.startX, e.clientY - start.startY) < SWEEP_THRESHOLD_PX) {
        return;
      }
      const projected = project(e.clientX, e.clientY);
      if (projected) {
        showBand(marqueeBetween(start.point, projected.point));
      }
    },
    [project, fallback, showBand],
  );

  const settle = useCallback(() => {
    const start = origin.current;
    const swept = bandRef.current;
    origin.current = null;
    showBand(null);
    if (!start) {
      return;
    }
    if (!swept) {
      // A click on bare plan: clear, unless shift-clicking to keep what's picked.
      if (!start.additive) {
        onSelectMany([]);
      }
      return;
    }
    const hits = idsInMarquee(documentMovables(doc), swept);
    // A shift-sweep UNIONS rather than toggles: sweeping over something you
    // already picked should never quietly drop it back out of the selection.
    onSelectMany(start.additive ? [...selectedIds, ...hits.filter((id) => !selectedIds.includes(id))] : hits);
  }, [doc, onSelectMany, selectedIds, showBand]);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (origin.current) {
        settle();
      } else {
        fallback.onPointerUp(e);
      }
    },
    [settle, fallback],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (origin.current) {
        origin.current = null;
        showBand(null);
      } else {
        fallback.onPointerCancel(e);
      }
    },
    [fallback, showBand],
  );

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    band,
  };
}
