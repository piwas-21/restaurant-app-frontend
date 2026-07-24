import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import type { AlignmentGuide } from '@/lib/floorPlan/snapping';
import styles from './EditorOverlay.module.css';

/**
 * The editor chrome drawn inside the scene `<svg>` but outside its rough filter
 * (FLOOR-PLAN-REVAMP §4.3) — crisp selection outline, live alignment guides, and
 * overlap warning outlines. Everything is derived from the rendered document, so
 * it tracks the live drag preview for free. Strokes are `non-scaling` (constant
 * screen width at any zoom); colours come from the inherited scene/feedback
 * tokens, never hex.
 */
interface EditorOverlayProps {
  document: FloorPlanDocument;
  selectedId: string | null;
  guides: AlignmentGuide[];
  overlaps: ReadonlySet<string>;
}

/** A rotated rectangle around a table footprint, padded outward by `padCm`. */
function Footprint({
  table,
  className,
  padCm = 0,
}: Readonly<{ table: FloorPlanTableGeometry; className: string; padCm?: number }>) {
  const cx = metresToCm(table.positionX);
  const cy = metresToCm(table.positionY);
  const hw = metresToCm(table.width) / 2 + padCm;
  const hh = metresToCm(table.height) / 2 + padCm;
  return (
    <rect
      className={className}
      x={-hw}
      y={-hh}
      width={hw * 2}
      height={hh * 2}
      transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${table.rotation})`}
    />
  );
}

export default function EditorOverlay({ document: doc, selectedId, guides, overlaps }: Readonly<EditorOverlayProps>) {
  const widthCm = metresToCm(doc.widthMeters);
  const heightCm = metresToCm(doc.heightMeters);
  const selected = selectedId ? doc.tables.find((t) => t.id === selectedId) : undefined;
  return (
    <g aria-hidden="true">
      {doc.tables
        .filter((t) => overlaps.has(t.id))
        .map((t) => (
          <Footprint key={`warn-${t.id}`} table={t} className={styles.warn} padCm={2} />
        ))}
      {guides.map((g) =>
        g.axis === 'x' ? (
          <line
            key={`gx-${g.atMeters}`}
            className={styles.guide}
            x1={metresToCm(g.atMeters)}
            y1={0}
            x2={metresToCm(g.atMeters)}
            y2={heightCm}
          />
        ) : (
          <line
            key={`gy-${g.atMeters}`}
            className={styles.guide}
            x1={0}
            y1={metresToCm(g.atMeters)}
            x2={widthCm}
            y2={metresToCm(g.atMeters)}
          />
        ),
      )}
      {selected && <Footprint table={selected} className={styles.selection} padCm={6} />}
    </g>
  );
}
