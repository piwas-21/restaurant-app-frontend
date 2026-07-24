import type { KeyboardEvent } from 'react';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { tableParts, type TableParts } from '@/lib/floorPlan/tableGeometry';
import type { SceneStyles, TableRenderState } from './sceneTypes';

/**
 * The tables — the interactive layer. Each table's top and chairs live inside a
 * rotate group so a rotated 8-top still looks like an 8-top; the number is a
 * sibling *outside* that group so it stays upright and readable (§4.2, the fix
 * for the old rotation bug). State (available / selected / booked / small / dim)
 * drives only the fill and opacity — never the geometry — so the guest map and
 * the admin editor render byte-identical tables.
 */

interface TablesLayerProps {
  tables: FloorPlanTableGeometry[];
  states?: Readonly<Record<string, TableRenderState>>;
  styles: SceneStyles;
  /** When provided, non-booked / non-small tables become clickable buttons. */
  onSelectTable?: (id: string) => void;
  /** Accessible label for a table in a given state (i18n from the consumer). */
  formatTableLabel?: (table: FloorPlanTableGeometry, state: TableRenderState) => string;
}

const numberFontCm = (t: FloorPlanTableGeometry): number => Math.max(20, Math.min(t.width, t.height) * 34);

const defaultLabel = (t: FloorPlanTableGeometry, state: TableRenderState): string =>
  `Table ${t.tableNumber}, ${t.maxGuests} seats, ${state}`;

function TableShape({ parts, styles }: Readonly<{ parts: TableParts; styles: SceneStyles }>) {
  return (
    <>
      {parts.backs.map((b) => (
        <rect
          key={`b-${b.x}-${b.y}`}
          className={styles.chair}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx={b.rx}
        />
      ))}
      {parts.chairs.map((c) => (
        <rect
          key={`c-${c.cx}-${c.cy}-${c.angle}`}
          className={styles.chair}
          x={c.cx - c.width / 2}
          y={c.cy - c.height / 2}
          width={c.width}
          height={c.height}
          rx={c.rx}
          transform={`rotate(${c.angle.toFixed(1)} ${c.cx.toFixed(1)} ${c.cy.toFixed(1)})`}
        />
      ))}
      {parts.top.kind === 'circle' ? (
        <circle className={styles.tableTop} cx={0} cy={0} r={parts.top.r} />
      ) : (
        <rect
          className={styles.tableTop}
          x={parts.top.x}
          y={parts.top.y}
          width={parts.top.width}
          height={parts.top.height}
          rx={parts.top.rx}
        />
      )}
    </>
  );
}

interface TableGraphicProps {
  table: FloorPlanTableGeometry;
  state: TableRenderState;
  styles: SceneStyles;
  label: string;
  onSelectTable?: (id: string) => void;
}

function TableGraphic({ table, state, styles, label, onSelectTable }: Readonly<TableGraphicProps>) {
  const parts = tableParts(table.shape, table.maxGuests, table.width, table.height);
  const clickable = Boolean(onSelectTable) && state !== 'booked' && state !== 'small';
  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelectTable?.(table.id);
    }
  };
  return (
    <g
      data-table-id={table.id}
      data-state={state}
      className={[styles.table, clickable ? styles.tableHit : undefined].filter(Boolean).join(' ')}
      transform={`translate(${metresToCm(table.positionX).toFixed(1)} ${metresToCm(table.positionY).toFixed(1)})`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? state === 'selected' : undefined}
      aria-label={label}
      onClick={clickable ? () => onSelectTable?.(table.id) : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
    >
      <g transform={`rotate(${table.rotation})`}>
        <TableShape parts={parts} styles={styles} />
      </g>
      <text className={styles.num} x={0} y={0} fontSize={numberFontCm(table)}>
        {table.tableNumber}
      </text>
    </g>
  );
}

export default function TablesLayer({
  tables,
  states,
  styles,
  onSelectTable,
  formatTableLabel,
}: Readonly<TablesLayerProps>) {
  const label = formatTableLabel ?? defaultLabel;
  return (
    <g>
      {tables.map((table) => {
        const state = states?.[table.id] ?? 'available';
        return (
          <TableGraphic
            key={table.id}
            table={table}
            state={state}
            styles={styles}
            label={label(table, state)}
            onSelectTable={onSelectTable}
          />
        );
      })}
    </g>
  );
}
