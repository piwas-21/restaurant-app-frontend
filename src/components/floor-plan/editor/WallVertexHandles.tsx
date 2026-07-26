'use client';

import type { FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { segmentMidpoints } from '@/lib/floorPlan/wallEditing';
import { MIDPOINT_ATTR, VERTEX_ATTR } from '@/hooks/floorPlan/useWallVertexDrag';
import styles from './WallOverlay.module.css';

/**
 * The selected wall's corner and midpoint grips (FLOOR-PLAN-REVAMP §4.3). A
 * **corner dot** drags that vertex; a **midpoint dot** inserts a corner there and
 * drags it in the same motion. Both are sized in screen pixels taken through the
 * current zoom, so they stay grabbable whether the plan is fitted or zoomed in.
 *
 * The hit areas are far larger than the visible dots and are the only elements
 * here that take pointer events — the drawn dots would be a few pixels wide on a
 * fitted plan, which is unhittable on touch. These are affordances only: the
 * inspector edits the selected corner numerically and removes it (SC 2.5.7),
 * which is why the whole layer sits inside the overlay's `aria-hidden` group.
 */

const VERTEX_PX = 11;
const MIDPOINT_PX = 8;
const HIT_PX = 30;

const round = (value: number): number => Number(value.toFixed(2));
const toCm = (p: FloorPlanPoint) => ({ x: round(metresToCm(p.x)), y: round(metresToCm(p.y)) });

interface WallVertexHandlesProps {
  wall: FloorPlanWall;
  /** The corner the inspector is pointed at, drawn as picked. */
  selectedVertex: number | null;
  /** Screen pixels per plan centimetre. */
  pxPerCm: number;
}

export default function WallVertexHandles({ wall, selectedVertex, pxPerCm }: Readonly<WallVertexHandlesProps>) {
  /** Screen pixels as plan centimetres at the current zoom. */
  const cm = (px: number) => round(px / pxPerCm);
  const hit = cm(HIT_PX) / 2;

  return (
    <g>
      {segmentMidpoints(wall).map((mid) => {
        const p = toCm(mid.point);
        return (
          <g key={`mid-${mid.segmentIndex}`}>
            <circle className={styles.grabHit} {...{ [MIDPOINT_ATTR]: mid.segmentIndex }} cx={p.x} cy={p.y} r={hit} />
            <circle className={styles.midpoint} cx={p.x} cy={p.y} r={cm(MIDPOINT_PX) / 2} />
          </g>
        );
      })}
      {wall.points.map((point, index) => {
        const p = toCm(point);
        return (
          <g key={`v-${p.x},${p.y},${index}`}>
            <circle className={styles.grabHit} {...{ [VERTEX_ATTR]: index }} cx={p.x} cy={p.y} r={hit} />
            <circle
              className={index === selectedVertex ? styles.vertexPicked : styles.vertex}
              cx={p.x}
              cy={p.y}
              r={cm(VERTEX_PX) / 2}
            />
          </g>
        );
      })}
    </g>
  );
}
