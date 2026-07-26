import type { FloorPlanItem } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { ENTRANCE_SYMBOL } from '@/lib/floorPlan/symbolsStructure';
import FloorPlanSymbol from './FloorPlanSymbol';
import type { SceneStyles } from './sceneTypes';

/**
 * The three wayfinding shapes (FLOOR-PLAN-REVAMP §4.3) — a **zone region**, a
 * **tape text label** and the **entrance arrow**. They live together here, and
 * not inside the layers that place them, because three consumers draw them and
 * all three must draw the *same* thing: `ItemsLayer` (zones, under the tables),
 * `LabelsLayer` (labels and the entrance, over them), and the editor's palette,
 * whose preview would otherwise be a second illustration free to drift from what
 * a click actually places.
 */

/** A named soft region — dimmed fill under the tables, name on a tape tag. */
export function ZoneRegion({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
  const x = metresToCm(item.x - item.widthMeters / 2);
  const y = metresToCm(item.y - item.heightMeters / 2);
  const name = item.label ?? '';
  const tagWidth = Math.max(90, name.length * 17);
  return (
    <g>
      <rect
        className={styles.zoneRegion}
        x={x}
        y={y}
        width={metresToCm(item.widthMeters)}
        height={metresToCm(item.heightMeters)}
        rx={14}
      />
      {name && (
        <>
          <rect className={styles.flag} x={x + 14} y={y - 16} width={tagWidth} height={32} rx={3} />
          <text className={styles.tagText} x={x + 14 + tagWidth / 2} y={y} fontSize={21}>
            {name}
          </text>
        </>
      )}
    </g>
  );
}

/** A masking-tape text tag, rotated with the item so it can run along a wall. */
export function TapeLabel({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
  const halfW = metresToCm(item.widthMeters) / 2;
  const halfH = metresToCm(item.heightMeters) / 2;
  return (
    <g transform={`translate(${metresToCm(item.x)} ${metresToCm(item.y)}) rotate(${item.rotationDegrees})`}>
      <rect
        className={styles.flag}
        x={-halfW}
        y={-halfH}
        width={metresToCm(item.widthMeters)}
        height={metresToCm(item.heightMeters)}
        rx={3}
      />
      <text className={styles.tagText} x={0} y={1} fontSize={item.heightMeters * 62}>
        {item.label ?? ''}
      </text>
    </g>
  );
}

/**
 * The entrance marker — **only an arrow**. The doorway itself is drawn by the
 * wall opening it sits in; letting the marker draw its own leaf and swing
 * produced two doors in different places (§4.4).
 */
export function EntranceMarker({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
  const symbol = ENTRANCE_SYMBOL;
  const sx = metresToCm(item.widthMeters) / symbol.w;
  const sy = metresToCm(item.heightMeters) / symbol.h;
  const transform =
    `translate(${metresToCm(item.x)} ${metresToCm(item.y)}) rotate(${item.rotationDegrees}) ` +
    `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-symbol.w / 2} ${-symbol.h / 2})`;
  return (
    <g transform={transform}>
      <FloorPlanSymbol def={symbol} styles={styles} />
    </g>
  );
}
