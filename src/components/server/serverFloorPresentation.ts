import type { TFunction } from 'i18next';
import type { TableRenderState } from '@/components/floor-plan/sceneTypes';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';
import type { ServerFloorTable } from '@/types/serverWorkspace';
import { isKnownServerFloorTableState, toFloorPlanShape } from '@/types/serverWorkspace';

export function renderState(table: ServerFloorTable, selected: boolean): TableRenderState {
  if (!isKnownServerFloorTableState(table.state)) return 'unavailable';
  if (selected) return 'selected';
  if (table.state === 'Reserved') return 'booked';
  if (table.state === 'Ready') return 'ready';
  if (table.state === 'Open' || table.state === 'Ambiguous') return 'occupied';
  if (table.state === 'Inactive') return 'dim';
  return 'available';
}

export function geometryFor(table: ServerFloorTable): FloorPlanTableGeometry {
  return {
    id: table.tableId,
    tableNumber: table.tableLabel,
    maxGuests: table.maxGuests,
    isActive: table.isActive,
    isOutdoor: table.isOutdoor,
    positionX: table.positionX,
    positionY: table.positionY,
    width: table.width,
    height: table.height,
    shape: toFloorPlanShape(table.shape),
    rotation: table.rotation,
  };
}

function statusLabelKey(state: string): string {
  switch (state) {
    case 'Ready':
      return 'server.status_ready';
    case 'Reserved':
      return 'server.status_reserved';
    case 'Open':
      return 'server.status_occupied';
    case 'Inactive':
      return 'server.status_closed';
    case 'Ambiguous':
      return 'cashier.tables.status_legacy';
    case 'Available':
      return 'server.status_available';
    default:
      return 'unavailable';
  }
}

export function tableLabel(table: ServerFloorTable, t: TFunction): string {
  const statusKey = statusLabelKey(table.state);
  const statusFallback = isKnownServerFloorTableState(table.state) ? table.state : t('unavailable', 'Unavailable');
  return t('table_marker_aria', 'Table {{number}}, {{seats}} seats, {{status}}', {
    number: table.tableLabel,
    seats: table.maxGuests,
    status: t(statusKey, statusFallback),
  });
}
