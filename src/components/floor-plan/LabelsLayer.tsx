import type { FloorPlanItem } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { getSymbol } from '@/lib/floorPlan/symbols';
import FloorPlanSymbol from './FloorPlanSymbol';
import type { SceneStyles } from './sceneTypes';

/**
 * Wayfinding text on top of the plan (§4.4): masking-tape text tags and the
 * entrance marker (an arrow — the doorway itself is drawn by the wall opening).
 * These sit above the tables so they stay legible. Foreground z-order.
 */

const LABEL_KINDS = new Set(['label', 'text_label']);

function TapeLabel({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
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

function EntranceMarker({ item, styles }: Readonly<{ item: FloorPlanItem; styles: SceneStyles }>) {
  const symbol = getSymbol('entrance');
  if (!symbol) {
    return null;
  }
  const sx = metresToCm(item.widthMeters) / symbol.w;
  const sy = metresToCm(item.heightMeters) / symbol.h;
  const transform =
    `translate(${metresToCm(item.x)} ${metresToCm(item.y)}) rotate(${item.rotationDegrees}) ` +
    `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-symbol.w / 2} ${-symbol.h / 2})`;
  return (
    <g transform={transform} aria-hidden="true">
      <FloorPlanSymbol def={symbol} styles={styles} />
    </g>
  );
}

export default function LabelsLayer({ items, styles }: Readonly<{ items: FloorPlanItem[]; styles: SceneStyles }>) {
  const labels = items.filter((it) => LABEL_KINDS.has(it.kind) || it.kind === 'entrance');
  return (
    <g>
      {labels.map((item) => {
        const key = item.id ?? `${item.kind}-${item.x}-${item.y}-${item.zIndex}`;
        return item.kind === 'entrance' ? (
          <EntranceMarker key={key} item={item} styles={styles} />
        ) : (
          <TapeLabel key={key} item={item} styles={styles} />
        );
      })}
    </g>
  );
}
