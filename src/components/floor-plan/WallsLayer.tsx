import type { FloorPlanWall } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { segmentPieces, wallSegments, type SegmentPiece, type WallSegment } from '@/lib/floorPlan/walls';
import type { SceneStyles } from './sceneTypes';

/**
 * Walls and their openings (§4.3). Each wall segment is drawn as a thick stroke
 * broken by its openings: a window is a thin glazing line across the gap, a door
 * a leaf + swing arc, a plain opening just a gap. Ported from the prototype's
 * `renderWalls`. Stroke *width* is per-wall data (an attribute); only the colour
 * comes from the skin.
 */

const MIN_THICKNESS_CM = 6;
const WINDOW_RATIO = 0.34;

/** A point at `dist` metres along a segment, in centimetres. */
function pointAtCm(seg: WallSegment, dist: number): { x: number; y: number } {
  return {
    x: metresToCm(seg.start.x + Math.cos(seg.angleRad) * dist),
    y: metresToCm(seg.start.y + Math.sin(seg.angleRad) * dist),
  };
}

function DoorSwing({ seg, piece, styles }: Readonly<{ seg: WallSegment; piece: SegmentPiece; styles: SceneStyles }>) {
  const hinge = pointAtCm(seg, piece.from);
  const widthCm = metresToCm(piece.to - piece.from);
  const angle = (seg.angleRad * 180) / Math.PI;
  return (
    <g transform={`translate(${hinge.x} ${hinge.y}) rotate(${angle})`}>
      <rect className={styles.fill} x={0} y={-4} width={widthCm * 0.06 + 5} height={8} />
      <path
        className={styles.lnThin}
        d={`M6 0 L6 -${widthCm} M6 -${widthCm} A ${widthCm} ${widthCm} 0 0 1 ${widthCm} 0`}
        opacity={0.75}
      />
    </g>
  );
}

function SegmentPieceShape({
  seg,
  piece,
  thicknessCm,
  styles,
}: Readonly<{ seg: WallSegment; piece: SegmentPiece; thicknessCm: number; styles: SceneStyles }>) {
  if (piece.kind === 'opening') {
    return null; // a plain gap in the wall
  }
  if (piece.kind === 'door') {
    return <DoorSwing seg={seg} piece={piece} styles={styles} />;
  }
  const a = pointAtCm(seg, piece.from);
  const b = pointAtCm(seg, piece.to);
  const isWindow = piece.kind === 'window';
  return (
    <line
      className={isWindow ? styles.window : styles.wall}
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      strokeWidth={isWindow ? thicknessCm * WINDOW_RATIO : thicknessCm}
      strokeLinecap="butt"
    />
  );
}

export default function WallsLayer({ walls, styles }: Readonly<{ walls: FloorPlanWall[]; styles: SceneStyles }>) {
  return (
    <g>
      {walls.map((wall, wi) => {
        const thicknessCm = Math.max(MIN_THICKNESS_CM, metresToCm(wall.thicknessMeters));
        return wallSegments(wall).map((seg) => {
          const openings = wall.openings.filter((o) => o.segmentIndex === seg.index);
          return segmentPieces(seg.length, openings).map((piece) => (
            <SegmentPieceShape
              key={`${wall.id ?? wi}-${seg.index}-${piece.kind}-${piece.from.toFixed(3)}`}
              seg={seg}
              piece={piece}
              thicknessCm={thicknessCm}
              styles={styles}
            />
          ));
        });
      })}
    </g>
  );
}
