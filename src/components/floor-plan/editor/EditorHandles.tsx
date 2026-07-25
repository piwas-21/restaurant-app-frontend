'use client';

import { useTranslation } from 'react-i18next';
import { metresToCm, rectCorners, type OrientedRect } from '@/lib/floorPlan/geometry';
import {
  RESIZE_HANDLES,
  ROTATE_HANDLE,
  handlePoint,
  rotateHandlePoint,
  type ResizeHandleId,
} from '@/lib/floorPlan/handles';
import type { ActiveGesture } from '@/hooks/floorPlan/editorStage';
import type { MovableGeometry } from '@/lib/floorPlan/movable';
import type { FloorPlanPoint } from '@/types/floorPlan';
import styles from './EditorHandles.module.css';

/**
 * The selection's on-canvas grips (FLOOR-PLAN-REVAMP §4.3/§4.4) — eight resize
 * grips plus a rotate grip on an arm above the shape. Every size here is a
 * **screen pixel converted through the current zoom**, so the grips stay the same
 * size (and stay grabbable) whether the plan is fitted or zoomed right in. They
 * are pointer affordances only: rotation and size are equally reachable from the
 * inspector and the keyboard (SC 2.5.7), which is why this whole layer sits
 * inside the overlay's `aria-hidden` group. It draws a plain rect, so a table and
 * a placed item get the same grips from the same code.
 */

const GRIP_PX = 10;
/** Generous touch target; the inspector is the SC 2.5.8 equivalent control. */
const GRIP_HIT_PX = 26;
const ROTATE_ARM_PX = 34;
const ROTATE_GRIP_PX = 20;
const ROTATE_HIT_PX = 44;
const BADGE_GAP_PX = 16;
const BADGE_FONT_PX = 12;

/** Resize cursor per grip axis — approximate once rotated, as in every design tool. */
const CURSORS: Record<ResizeHandleId, string> = {
  nw: styles.nwse,
  se: styles.nwse,
  ne: styles.nesw,
  sw: styles.nesw,
  n: styles.ns,
  s: styles.ns,
  e: styles.ew,
  w: styles.ew,
};

/** Two decimals of a centimetre — sub-pixel even at the viewport's tightest zoom. */
const round = (value: number): number => Number(value.toFixed(2));
const toCm = (p: FloorPlanPoint) => ({ x: round(metresToCm(p.x)), y: round(metresToCm(p.y)) });
const cornerPoints = (rect: OrientedRect): string =>
  rectCorners(rect)
    .map((p) => `${round(metresToCm(p.x))},${round(metresToCm(p.y))}`)
    .join(' ');

interface EditorHandlesProps {
  /** The single selection's footprint — a table or an item, normalised. */
  rect: MovableGeometry;
  /** Screen pixels per plan centimetre; 0 until the stage has been measured. */
  pxPerCm: number;
  /** The live gesture, for the pre-gesture ghost and the measurement badge. */
  gesture: ActiveGesture | null;
}

export default function EditorHandles({ rect, pxPerCm, gesture }: Readonly<EditorHandlesProps>) {
  const { t } = useTranslation();
  if (pxPerCm <= 0) {
    return null;
  }

  /** Screen pixels as plan centimetres at the current zoom. */
  const cm = (px: number) => round(px / pxPerCm);
  const grip = cm(GRIP_PX);
  const hit = cm(GRIP_HIT_PX);
  const rotate = toCm(rotateHandlePoint(rect, cm(ROTATE_ARM_PX) / 100));
  /** A zero-length arm is the top edge's midpoint — where the arm is anchored. */
  const armFoot = toCm(rotateHandlePoint(rect, 0));

  const ghost = gesture && gesture.kind !== 'move' ? cornerPoints(gesture.origin) : null;

  let badge: string | null = null;
  if (gesture?.kind === 'rotate') {
    badge = t('editor_angle_badge', '{{degrees}}°', { degrees: Math.round(rect.rotationDegrees) });
  } else if (gesture?.kind === 'resize') {
    badge = t('editor_size_badge', '{{width}} × {{height}} m', {
      width: rect.widthMeters.toFixed(2),
      height: rect.heightMeters.toFixed(2),
    });
  }

  return (
    <g className={styles.handles}>
      {ghost && <polygon className={styles.ghost} points={ghost} />}
      <line className={styles.arm} x1={armFoot.x} y1={armFoot.y} x2={rotate.x} y2={rotate.y} />
      {RESIZE_HANDLES.map((anchor) => {
        const p = toCm(handlePoint(rect, anchor));
        return (
          <g key={anchor.id}>
            <rect
              className={`${styles.hit} ${CURSORS[anchor.id]}`}
              data-handle={anchor.id}
              x={p.x - hit / 2}
              y={p.y - hit / 2}
              width={hit}
              height={hit}
            />
            <rect
              className={styles.grip}
              x={p.x - grip / 2}
              y={p.y - grip / 2}
              width={grip}
              height={grip}
              rx={round(grip * 0.28)}
              transform={`rotate(${rect.rotationDegrees} ${p.x} ${p.y})`}
            />
          </g>
        );
      })}
      <circle
        className={`${styles.hit} ${styles.rotateHit}`}
        data-handle={ROTATE_HANDLE}
        cx={rotate.x}
        cy={rotate.y}
        r={cm(ROTATE_HIT_PX) / 2}
      />
      <circle className={styles.grip} cx={rotate.x} cy={rotate.y} r={cm(ROTATE_GRIP_PX) / 2} />
      {badge && (
        <text className={styles.badge} x={rotate.x} y={rotate.y - cm(BADGE_GAP_PX)} fontSize={cm(BADGE_FONT_PX)}>
          {badge}
        </text>
      )}
    </g>
  );
}
