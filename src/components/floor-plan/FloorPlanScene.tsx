'use client';

import type { ReactNode } from 'react';
import type { FloorPlanDocument, FloorPlanItem, FloorPlanTableGeometry } from '@/types/floorPlan';
import { computeViewBox, metresToCm, type ViewBox } from '@/lib/floorPlan/geometry';
import RoomsLayer from './RoomsLayer';
import WallsLayer from './WallsLayer';
import ItemsLayer from './ItemsLayer';
import TablesLayer from './TablesLayer';
import LabelsLayer from './LabelsLayer';
import SceneDefs from './SceneDefs';
import type { SelectTable, TableRenderState } from './sceneTypes';
import styles from './FloorPlanScene.module.css';

/**
 * The one floor-plan renderer (FLOOR-PLAN-REVAMP §4.0) — a single SVG in a
 * centimetre viewBox, shared by the guest `/reservations` map and the admin
 * editor's canvas. Because there is no second renderer, "the guest and admin
 * views can't drift" is structural, not a discipline. Layer order is fixed
 * here: floors → grid → walls → items → tables → labels. Skinning is entirely
 * in the CSS module + the template `skinClassName` (stroke weight, number font,
 * the craft rough filter); the geometry this component emits never depends on
 * the skin, which the mirroring test enforces.
 */

interface FloorPlanSceneProps {
  document: FloorPlanDocument;
  /** Template token class setting the `--fp-*` skin scalars (craft / classic). */
  skinClassName?: string;
  /** Per-table render state (default: every table `available`). */
  tableStates?: Readonly<Record<string, TableRenderState>>;
  onSelectTable?: SelectTable;
  formatTableLabel?: (table: FloorPlanTableGeometry, state: TableRenderState) => string;
  /** Editor only: makes placed items focusable + selectable (guests get scenery). */
  onSelectItem?: SelectTable;
  formatItemLabel?: (item: FloorPlanItem) => string;
  /** Which items are picked, so a selectable item can announce its state. */
  selectedItemIds?: readonly string[];
  /** Draw the editor grid (admin only). */
  showGrid?: boolean;
  /** Override the fitted viewBox — the guest map drives zoom/pan through this. */
  viewBox?: ViewBox;
  role?: 'group' | 'application';
  ariaLabel?: string;
  /**
   * Editor chrome drawn in the same centimetre space as the scene but *outside*
   * the rough filter, so selection boxes, snap guides and handles stay crisp
   * (FLOOR-PLAN-REVAMP §4.0 — the overlay lives inside the one `<svg>`).
   */
  overlay?: ReactNode;
}

function Grid({ widthCm, heightCm, stepCm }: Readonly<{ widthCm: number; heightCm: number; stepCm: number }>) {
  const step = Math.max(stepCm, 1);
  const xs = Array.from({ length: Math.floor(widthCm / step) + 1 }, (_, i) => i * step);
  const ys = Array.from({ length: Math.floor(heightCm / step) + 1 }, (_, i) => i * step);
  return (
    <g>
      {xs.map((x) => (
        <line
          key={`gx${x}`}
          className={x % 100 ? styles.gridLine : styles.gridMajor}
          x1={x}
          y1={0}
          x2={x}
          y2={heightCm}
        />
      ))}
      {ys.map((y) => (
        <line
          key={`gy${y}`}
          className={y % 100 ? styles.gridLine : styles.gridMajor}
          x1={0}
          y1={y}
          x2={widthCm}
          y2={y}
        />
      ))}
    </g>
  );
}

export default function FloorPlanScene({
  document,
  skinClassName,
  tableStates,
  onSelectTable,
  formatTableLabel,
  onSelectItem,
  formatItemLabel,
  selectedItemIds,
  showGrid = false,
  viewBox,
  role = 'group',
  ariaLabel = 'Restaurant floor plan',
  overlay,
}: Readonly<FloorPlanSceneProps>) {
  const vb = viewBox ?? computeViewBox(document.widthMeters, document.heightMeters);
  const className = [styles.scene, skinClassName].filter(Boolean).join(' ');
  return (
    <svg
      className={className}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      role={role}
      aria-label={ariaLabel}
    >
      <SceneDefs />
      <g className={styles.rough}>
        <RoomsLayer walls={document.walls} styles={styles} />
        {showGrid && (
          <Grid
            widthCm={metresToCm(document.widthMeters)}
            heightCm={metresToCm(document.heightMeters)}
            stepCm={document.gridSizeCm}
          />
        )}
        <WallsLayer walls={document.walls} styles={styles} />
        <ItemsLayer
          items={document.items}
          styles={styles}
          onSelectItem={onSelectItem}
          formatItemLabel={formatItemLabel}
          selectedItemIds={selectedItemIds}
        />
        <TablesLayer
          tables={document.tables}
          states={tableStates}
          styles={styles}
          onSelectTable={onSelectTable}
          formatTableLabel={formatTableLabel}
        />
        {/* Same handlers as ItemsLayer: labels and the entrance are objects the
            editor moves too (S8). Only the LAYER differs — they sit above the
            tables so they stay legible (§4.4). */}
        <LabelsLayer
          items={document.items}
          styles={styles}
          onSelectItem={onSelectItem}
          formatItemLabel={formatItemLabel}
          selectedItemIds={selectedItemIds}
        />
      </g>
      {overlay}
    </svg>
  );
}
