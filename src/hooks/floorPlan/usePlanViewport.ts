'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { computeViewBox, screenToPlanCm, type ViewBox } from '@/lib/floorPlan/geometry';
import { isZoomed as isZoomedVb, panViewBox, zoomViewBox } from '@/lib/floorPlan/viewport';

const BUTTON_ZOOM = 1.4;
const WHEEL_BASE = 1.0015;

/**
 * Zoom / pan / fit state for the guest map (FLOOR-PLAN-REVAMP §4.2). Zooming is
 * always reachable without a gesture (the +/−/Fit buttons — SC 2.5.7); the
 * gestures are additive: ⌘/Ctrl-wheel zooms about the cursor, a one-finger drag
 * on empty plan pans, two fingers pinch. Dragging that starts on a table is left
 * alone so a tap still selects. All maths lives in `lib/floorPlan/viewport`.
 */
export function usePlanViewport(widthMeters: number, heightMeters: number, enabled = true) {
  const bounds = useMemo(() => computeViewBox(widthMeters, heightMeters), [widthMeters, heightMeters]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox>(bounds);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panningId = useRef<number | null>(null);
  const pinchDist = useRef<number | null>(null);

  // Refit whenever the plan's dimensions change (e.g. the document loads).
  useEffect(() => setViewBox(bounds), [bounds]);

  const fit = useCallback(() => setViewBox(bounds), [bounds]);
  const zoomBy = useCallback(
    (factor: number) => setViewBox((vb) => zoomViewBox(vb, factor, { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }, bounds)),
    [bounds],
  );
  const zoomIn = useCallback(() => zoomBy(BUTTON_ZOOM), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / BUTTON_ZOOM), [zoomBy]);

  // Wheel needs a non-passive native listener so ⌘/Ctrl-zoom can preventDefault.
  // `enabled` is keyed to the stage actually being mounted (the map is behind a
  // loading state), so the listener attaches even when the plan's dimensions
  // happen to equal the pre-load fallback and `bounds` never changes identity.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !enabled) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setViewBox((vb) =>
        zoomViewBox(vb, WHEEL_BASE ** -e.deltaY, screenToPlanCm(e.clientX, e.clientY, vb, rect), bounds),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [bounds, enabled]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const onTable = (e.target as Element).closest('[data-table-id]');
    if (!onTable && pointers.current.size === 1) {
      panningId.current = e.pointerId;
      stageRef.current?.setPointerCapture?.(e.pointerId);
    }
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) {
        return;
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const pts = [...pointers.current.values()];
      if (pts.length >= 2) {
        panningId.current = null;
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist.current && dist > 0) {
          const focus = screenToPlanCm((a.x + b.x) / 2, (a.y + b.y) / 2, viewBox, rect);
          setViewBox((vb) => zoomViewBox(vb, dist / pinchDist.current!, focus, bounds));
        }
        pinchDist.current = dist;
      } else if (panningId.current === e.pointerId) {
        setViewBox((vb) =>
          panViewBox(
            vb,
            ((e.clientX - prev.x) * vb.w) / rect.width,
            ((e.clientY - prev.y) * vb.h) / rect.height,
            bounds,
          ),
        );
      }
    },
    [bounds, viewBox],
  );

  const endPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (panningId.current === e.pointerId) {
      panningId.current = null;
    }
    if (pointers.current.size < 2) {
      pinchDist.current = null;
    }
  }, []);

  return {
    stageRef,
    viewBox,
    fit,
    zoomIn,
    zoomOut,
    isZoomed: isZoomedVb(viewBox, bounds),
    stageHandlers: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer },
  };
}
