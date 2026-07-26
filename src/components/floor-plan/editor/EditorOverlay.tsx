import type { FloorPlanDocument, FloorPlanWall } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import type { AlignmentGuide } from '@/lib/floorPlan/snapping';
import type { MarqueeRect } from '@/lib/floorPlan/selection';
import { selectedMovables, tableMovable, type MovableGeometry } from '@/lib/floorPlan/movable';
import type { ActiveGesture } from '@/hooks/floorPlan/editorStage';
import type { WallDraftState } from '@/hooks/floorPlan/useWallDraft';
import EditorHandles from './EditorHandles';
import WallOverlay from './WallOverlay';
import styles from './EditorOverlay.module.css';

/**
 * The editor chrome drawn inside the scene `<svg>` but outside its rough filter
 * (FLOOR-PLAN-REVAMP §4.3) — crisp selection outline, live alignment guides,
 * overlap warning outlines and the selection's rotate/resize grips. Everything is
 * derived from the rendered document, so it tracks the live gesture preview for
 * free, and everything selectable is outlined the same way whether it is a table
 * or a placed item. Strokes are `non-scaling` (constant screen width at any zoom);
 * colours come from the inherited scene/feedback tokens, never hex.
 */
interface EditorOverlayProps {
  document: FloorPlanDocument;
  selectedIds: readonly string[];
  /** The live rubber band, while one is being swept. */
  marquee: MarqueeRect | null;
  guides: AlignmentGuide[];
  overlaps: ReadonlySet<string>;
  /** Screen pixels per plan centimetre — sizes the constant-screen-size grips. */
  pxPerCm: number;
  gesture: ActiveGesture | null;
  /** The chain the Wall tool is drawing, or null when it is not active. */
  wallDraft: WallDraftState | null;
  selectedWall: FloorPlanWall | null;
}

/** A rotated rectangle around a footprint, padded outward by `padCm`. */
function Footprint({
  rect,
  className,
  padCm = 0,
}: Readonly<{ rect: MovableGeometry; className: string; padCm?: number }>) {
  const cx = metresToCm(rect.x);
  const cy = metresToCm(rect.y);
  const hw = metresToCm(rect.widthMeters) / 2 + padCm;
  const hh = metresToCm(rect.heightMeters) / 2 + padCm;
  return (
    <rect
      className={className}
      x={-hw}
      y={-hh}
      width={hw * 2}
      height={hh * 2}
      transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rect.rotationDegrees})`}
    />
  );
}

export default function EditorOverlay({
  document: doc,
  selectedIds,
  marquee,
  guides,
  overlaps,
  pxPerCm,
  gesture,
  wallDraft,
  selectedWall,
}: Readonly<EditorOverlayProps>) {
  const widthCm = metresToCm(doc.widthMeters);
  const heightCm = metresToCm(doc.heightMeters);
  const selected = selectedMovables(doc, selectedIds);
  // Grips belong to a single selection — with several picked, arranging them is
  // the inspector's align/distribute job, not a per-object drag.
  const only = selected.length === 1 ? selected[0] : undefined;
  return (
    <g aria-hidden="true">
      {doc.tables
        .filter((t) => overlaps.has(t.id))
        .map((t) => (
          <Footprint key={`warn-${t.id}`} rect={tableMovable(t)} className={styles.warn} padCm={2} />
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
      {selected.map((m) => (
        <Footprint key={`sel-${m.id}`} rect={m} className={styles.selection} padCm={6} />
      ))}
      {only && <EditorHandles rect={only} pxPerCm={pxPerCm} gesture={gesture} />}
      <WallOverlay draft={wallDraft} selectedWall={selectedWall} pxPerCm={pxPerCm} />
      {marquee && (
        <rect
          className={styles.marquee}
          x={metresToCm(marquee.x)}
          y={metresToCm(marquee.y)}
          width={metresToCm(marquee.width)}
          height={metresToCm(marquee.height)}
        />
      )}
    </g>
  );
}
