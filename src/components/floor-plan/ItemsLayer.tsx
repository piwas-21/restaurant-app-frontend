import type { FloorPlanItem } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { getSymbol } from '@/lib/floorPlan/symbols';
import FloorPlanSymbol from './FloorPlanSymbol';
import type { SceneStyles } from './sceneTypes';

/**
 * Structure and decor items (bar, fireplace, plants, …) plus zone regions.
 * Fixed furniture is drawn in the muted scenery ink so it recedes and reads as
 * non-interactive (§4.2). Text labels and the entrance marker are handled by
 * {@link LabelsLayer}. Each symbol is authored in its own box and scaled to the
 * item's metre footprint; rotation is about the item centre.
 */

const HANDLED_ELSEWHERE = new Set(['label', 'text_label', 'entrance']);

function ZoneRegion({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
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

function SymbolItem({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
  const symbol = getSymbol(item.kind);
  if (!symbol) {
    return null;
  }
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

export default function ItemsLayer({ items, styles }: Readonly<{ items: FloorPlanItem[]; styles: SceneStyles }>) {
  const drawn = items
    .filter((it) => !HANDLED_ELSEWHERE.has(it.kind))
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);
  return (
    <g>
      {drawn.map((item) => {
        const key = item.id ?? `${item.kind}-${item.x}-${item.y}-${item.zIndex}`;
        return item.kind === 'zone' ? (
          <ZoneRegion key={key} item={item} styles={styles} />
        ) : (
          <SymbolItem key={key} item={item} styles={styles} />
        );
      })}
    </g>
  );
}
