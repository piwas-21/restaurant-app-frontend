import type { FloorPlanPoint, FloorPlanWall } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { roomLabelAnchor } from '@/lib/floorPlan/walls';
import type { SceneStyles } from './sceneTypes';

/**
 * The floor layer — the enclosed area of each closed wall filled with its floor
 * texture, plus the room name inset at the top-left (§4.4). Room names get no
 * minimum-pixel floor: they are context, not content, so they fade out on a
 * phone rather than growing to dominate the plan. Bottom of the z-order.
 */

/** Floor style → the pattern id defined in the scene defs (stone/carpet reuse). */
const FLOOR_PATTERN: Record<string, string> = {
  wood: 'fp-floor-wood',
  deck: 'fp-floor-deck',
  tile: 'fp-floor-tile',
  stone: 'fp-floor-tile',
  carpet: 'fp-floor-wood',
};

const closedPath = (points: FloorPlanPoint[]): string =>
  points.map((p, i) => `${i ? 'L' : 'M'}${metresToCm(p.x)} ${metresToCm(p.y)}`).join(' ') + ' Z';

export default function RoomsLayer({ walls, styles }: Readonly<{ walls: FloorPlanWall[]; styles: SceneStyles }>) {
  const rooms = walls.filter((w) => w.isClosed && w.points.length >= 3);
  return (
    <g>
      {rooms.map((wall) => {
        const d = closedPath(wall.points);
        const patternId = FLOOR_PATTERN[wall.floorStyle ?? 'wood'] ?? 'fp-floor-wood';
        const anchor = roomLabelAnchor(wall);
        return (
          <g key={wall.id ?? d}>
            <path d={d} fill={`url(#${patternId})`} />
            {wall.roomName && anchor && (
              <text className={styles.roomName} x={metresToCm(anchor.x)} y={metresToCm(anchor.y)} fontSize={26}>
                {wall.roomName}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
