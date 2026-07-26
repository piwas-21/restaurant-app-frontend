'use client';

import { useTranslation } from 'react-i18next';
import type { FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { draftReadout } from '@/lib/floorPlan/wallDrafting';
import type { WallDraftState } from '@/hooks/floorPlan/useWallDraft';
import WallVertexHandles from './WallVertexHandles';
import styles from './WallOverlay.module.css';

/**
 * The wall tool's canvas chrome (FLOOR-PLAN-REVAMP §4.3) — the chain being drawn,
 * a rubber segment to the snapped cursor with its **live length and angle**, a
 * ring on the vertex a snap has locked onto, and the outline of a selected wall
 * with its corner and midpoint grips.
 *
 * The readout is the point of the whole overlay: without it the admin is guessing
 * at the metre length of the run they are drawing, which is the difference
 * between a plan that matches the room and one that merely looks like it.
 *
 * Sizes here are screen pixels taken through the current zoom, like the object
 * grips, so a vertex dot stays grabbable and legible fitted or zoomed right in.
 */

const VERTEX_PX = 9;
const SNAP_RING_PX = 16;
const READOUT_FONT_PX = 12;
const READOUT_GAP_PX = 14;

const cmPoint = (p: FloorPlanPoint) => ({ x: metresToCm(p.x), y: metresToCm(p.y) });
const polyline = (points: readonly FloorPlanPoint[]): string =>
  points.map((p) => `${metresToCm(p.x)},${metresToCm(p.y)}`).join(' ');

/**
 * The outline of a wall, or null when it has no run to draw. A **closed** wall's
 * outline repeats its first vertex, because `wallSegments` treats the join back
 * to the start as a real segment and so must this.
 */
function wallOutline(wall: FloorPlanWall | null): string | null {
  if (!wall || wall.points.length < 2) {
    return null;
  }
  return polyline(wall.isClosed ? [...wall.points, wall.points[0]] : wall.points);
}

interface WallOverlayProps {
  draft: WallDraftState | null;
  selectedWall: FloorPlanWall | null;
  /** The corner the inspector is pointed at, drawn as picked. */
  selectedVertex: number | null;
  /** Screen pixels per plan centimetre; 0 until the stage has been measured. */
  pxPerCm: number;
}

function DraftChain({ draft, cm }: Readonly<{ draft: WallDraftState; cm: (px: number) => number }>) {
  const { t } = useTranslation();
  const { points, cursor } = draft;
  const last = points.at(-1);
  const rubber = last && cursor ? { from: cmPoint(last), to: cmPoint(cursor.point) } : null;
  const readout = last && cursor ? draftReadout(last, cursor.point) : null;

  return (
    <g>
      {points.length > 1 && <polyline className={styles.draftLine} points={polyline(points)} />}
      {rubber && (
        <line className={styles.rubber} x1={rubber.from.x} y1={rubber.from.y} x2={rubber.to.x} y2={rubber.to.y} />
      )}
      {points.map((p) => {
        const c = cmPoint(p);
        return <circle key={`${c.x},${c.y}`} className={styles.vertex} cx={c.x} cy={c.y} r={cm(VERTEX_PX) / 2} />;
      })}
      {cursor && cursor.kind !== 'free' && (
        <circle
          className={cursor.kind === 'close' ? styles.snapClose : styles.snapRing}
          cx={cmPoint(cursor.point).x}
          cy={cmPoint(cursor.point).y}
          r={cm(SNAP_RING_PX) / 2}
        />
      )}
      {rubber && readout && readout.lengthMeters > 0 && (
        <text
          className={styles.readout}
          x={(rubber.from.x + rubber.to.x) / 2}
          y={(rubber.from.y + rubber.to.y) / 2 - cm(READOUT_GAP_PX)}
          fontSize={cm(READOUT_FONT_PX)}
        >
          {t('editor_wall_readout', '{{length}} m · {{angle}}°', {
            length: readout.lengthMeters.toFixed(2),
            angle: Math.round(readout.angleDegrees),
          })}
        </text>
      )}
    </g>
  );
}

export default function WallOverlay({ draft, selectedWall, selectedVertex, pxPerCm }: Readonly<WallOverlayProps>) {
  if (pxPerCm <= 0) {
    return null;
  }
  /** Screen pixels as plan centimetres at the current zoom. */
  const cm = (px: number) => Number((px / pxPerCm).toFixed(2));
  const outline = wallOutline(selectedWall);

  return (
    <g aria-hidden="true">
      {outline && <polyline className={styles.selectedWall} points={outline} />}
      {/* Grips only while the Select tool owns the plan: mid-draft every press
          belongs to the chain being drawn, and a stray grip would eat one. */}
      {selectedWall && !draft && (
        <WallVertexHandles wall={selectedWall} selectedVertex={selectedVertex} pxPerCm={pxPerCm} />
      )}
      {draft && <DraftChain draft={draft} cm={cm} />}
    </g>
  );
}
