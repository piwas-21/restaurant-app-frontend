import type { FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';
import { tableRoom } from '@/lib/floorPlan/zones';
import type { TableRenderState } from '../sceneTypes';

/**
 * Pure derivation of the guest map's per-table view state (FLOOR-PLAN-REVAMP
 * §4.2). A table's four+ states are computed from the live availability, the
 * chosen party size and the active zone filter — the zone itself resolved from
 * the room the table sits in (`tableRoom`). Kept pure so the map component and
 * the list share one truth and it is unit-tested.
 */

export interface GuestTableInfo {
  table: FloorPlanTableGeometry;
  /** The room the table sits in, or null when it is in no named room. */
  zone: string | null;
  state: TableRenderState;
  /** Free for the chosen party (drives the List's Select button + empty state). */
  bookable: boolean;
}

export interface GuestMapContext {
  walls: FloorPlanWall[];
  selectedIds: readonly string[];
  bookedIds: readonly string[];
  party: number;
  /** The active zone chip, or null for "everywhere". */
  zoneFilter: string | null;
}

function stateFor(
  table: FloorPlanTableGeometry,
  zone: string | null,
  selected: Set<string>,
  booked: Set<string>,
  ctx: GuestMapContext,
): TableRenderState {
  if (selected.has(table.id)) {
    return 'selected';
  }
  if (booked.has(table.id)) {
    return 'booked';
  }
  if (table.maxGuests < ctx.party) {
    return 'small';
  }
  if (ctx.zoneFilter && zone !== ctx.zoneFilter) {
    return 'dim';
  }
  return 'available';
}

/** Resolve every table's zone, state and bookability in one pass. */
export function tableInfos(tables: FloorPlanTableGeometry[], ctx: GuestMapContext): GuestTableInfo[] {
  const selected = new Set(ctx.selectedIds);
  const booked = new Set(ctx.bookedIds);
  return tables.map((table) => {
    const zone = tableRoom(table, ctx.walls);
    return {
      table,
      zone,
      state: stateFor(table, zone, selected, booked, ctx),
      bookable: !booked.has(table.id) && table.maxGuests >= ctx.party,
    };
  });
}

/** The `tableStates` map the scene consumes, keyed by table id. */
export function statesById(infos: GuestTableInfo[]): Record<string, TableRenderState> {
  const out: Record<string, TableRenderState> = {};
  for (const info of infos) {
    out[info.table.id] = info.state;
  }
  return out;
}
