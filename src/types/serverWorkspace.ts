import type { FloorPlanDocument, FloorPlanTableShape } from '@/types/floorPlan';
import type { ApiResponse } from '@/types/order/common';

export type KnownServerFloorTableState = 'Available' | 'Open' | 'Ready' | 'Reserved' | 'Ambiguous' | 'Inactive';
/** Keeps the known literals narrow while allowing additive backend states to arrive safely. */
type UnknownServerFloorTableState = string & {};
export type ServerFloorTableState = KnownServerFloorTableState | UnknownServerFloorTableState;

const KNOWN_TABLE_STATES: ReadonlySet<KnownServerFloorTableState> = new Set([
  'Available',
  'Open',
  'Ready',
  'Reserved',
  'Ambiguous',
  'Inactive',
]);

export function isKnownServerFloorTableState(state: string): state is KnownServerFloorTableState {
  return KNOWN_TABLE_STATES.has(state as KnownServerFloorTableState);
}

export interface ServerFloorReservation {
  reservationId: string;
  customerName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  status: string;
  isCurrent: boolean;
}

export interface ServerFloorLegacySummary {
  orderCount: number;
  activeOrderCount: number;
  readyOrderCount: number;
  outstanding: number;
}

export interface ServerFloorSessionSummary {
  serviceSessionId: string;
  version: number;
  openedAt: string;
  ageMinutes: number;
  currency?: string | null;
  total: number;
  paid: number;
  remaining: number;
  activeRoundCount: number;
  readyRoundCount: number;
  canCollect: boolean;
  canClose: boolean;
  hasLegacyAmbiguity: boolean;
}

export interface ServerFloorTable {
  tableId: string;
  tableLabel: string;
  zoneId?: string | null;
  zoneName?: string | null;
  isActive: boolean;
  isOutdoor: boolean;
  maxGuests: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  shape: FloorPlanTableShape | (string & {});
  rotation: number;
  state: ServerFloorTableState;
  activeRoundCount: number;
  readyRoundCount: number;
  session?: ServerFloorSessionSummary | null;
  legacy?: ServerFloorLegacySummary | null;
  reservation?: ServerFloorReservation | null;
  hasLegacyAmbiguity: boolean;
  permittedActions: string[];
}

export interface ServerFloorSnapshot {
  serverTime: string;
  tenantTime: string;
  nextStateChangeAt?: string | null;
  version: string;
  cursor: string;
  zones: FloorPlanDocument[];
  tables: ServerFloorTable[];
}

export type ServerFloorSnapshotApiResponse = ApiResponse<ServerFloorSnapshot>;

export function toFloorPlanShape(shape: string): FloorPlanTableShape {
  return shape === 'square' || shape === 'rectangle' || shape === 'booth' ? shape : 'round';
}
