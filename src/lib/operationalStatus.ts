import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';

export type TableServiceState = 'available' | 'occupied' | 'reserved' | 'closed';
export type ConnectionState = 'connected' | 'reconnecting' | 'stale' | 'offline';
/** Legacy stream values accepted while Cashier adopts the canonical vocabulary. */
export type ConnectionStateInput = ConnectionState | 'connecting' | 'disconnected' | 'error';
export type OperationState = 'saved' | 'sent' | 'committed' | 'failed' | 'unknown';

export interface OperationalStatusMeta {
  readonly i18nKey: string;
  readonly tone: StatusBadgeTone;
}

/** Shared operational vocabulary used by Server and Cashier surfaces. */
export const TABLE_SERVICE_STATUS_META: Readonly<Record<TableServiceState, OperationalStatusMeta>> = {
  available: { i18nKey: 'server.status_available', tone: 'success' },
  occupied: { i18nKey: 'server.status_occupied', tone: 'info' },
  reserved: { i18nKey: 'server.status_reserved', tone: 'warning' },
  closed: { i18nKey: 'server.status_closed', tone: 'neutral' },
};

export const CONNECTION_STATUS_META: Readonly<Record<ConnectionState, OperationalStatusMeta>> = {
  connected: { i18nKey: 'cashier.connected', tone: 'success' },
  reconnecting: { i18nKey: 'server.connecting', tone: 'warning' },
  stale: { i18nKey: 'server.status_stale', tone: 'warning' },
  offline: { i18nKey: 'cashier.disconnected', tone: 'danger' },
};

type LegacyConnectionState = Exclude<ConnectionStateInput, ConnectionState>;

const CONNECTION_STATE_ALIASES: Readonly<Record<LegacyConnectionState, ConnectionState>> = {
  connecting: 'reconnecting',
  disconnected: 'offline',
  error: 'offline',
};

function isCanonicalConnectionState(state: ConnectionStateInput): state is ConnectionState {
  return state === 'connected' || state === 'reconnecting' || state === 'stale' || state === 'offline';
}

export function normalizeConnectionState(state: ConnectionStateInput): ConnectionState {
  return isCanonicalConnectionState(state) ? state : CONNECTION_STATE_ALIASES[state];
}

export const OPERATION_STATUS_META: Readonly<Record<OperationState, OperationalStatusMeta>> = {
  saved: { i18nKey: 'staff.operation_saved', tone: 'success' },
  sent: { i18nKey: 'staff.operation_sent', tone: 'info' },
  committed: { i18nKey: 'staff.operation_committed', tone: 'success' },
  failed: { i18nKey: 'staff.operation_failed', tone: 'danger' },
  unknown: { i18nKey: 'staff.operation_unknown', tone: 'warning' },
};
