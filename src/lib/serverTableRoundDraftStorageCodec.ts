import type { OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import { readStaffCustomerSelection } from '@/types/staffCustomer';
import { decodeServerTableRoundItems } from './serverTableRoundDraftCodec';

export const SERVER_TABLE_ROUND_DRAFT_VERSION = 1;
export const SERVER_TABLE_ROUND_DRAFT_TTL_MS = 30 * 60 * 1000;
export const LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY = 'server.table-round-draft';
export const SCOPED_SERVER_TABLE_ROUND_DRAFT_PREFIX = `${LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY}:scope:`;

export interface ServerTableRoundDraft {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly items: OrderItem[];
  readonly notes: string;
  readonly customer?: StaffCustomerSelection;
  readonly clientOperationId?: string;
}

export interface ServerTableRoundDraftIdentity {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly staffUserId?: string;
}

export type ServerTableRoundDraftScope = { readonly tenantId: string; readonly staffUserId: string };
export type StoredDraft = Record<string, unknown>;
export type RestoredDraft =
  | { readonly kind: 'valid'; readonly draft: ServerTableRoundDraft; readonly normalizedValue?: string }
  | { readonly kind: 'expired' }
  | { readonly kind: 'invalid' };

function readAuthenticatedStaffUserId(): string | undefined {
  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return undefined;
    const user = JSON.parse(raw) as { email?: unknown };
    return text(user.email)?.trim().toLowerCase();
  } catch (error: unknown) {
    console.warn('Could not read the authenticated staff identity for round recovery', error);
    return undefined;
  }
}

export function getServerTableRoundDraftScope(staffUserId?: string): ServerTableRoundDraftScope | null {
  if (typeof window === 'undefined') return null;
  const tenantId = text(window.location.hostname)?.toLowerCase();
  const resolvedStaffUserId = text(staffUserId)?.trim().toLowerCase() ?? readAuthenticatedStaffUserId();
  if (!tenantId || !resolvedStaffUserId) return null;
  return { tenantId, staffUserId: resolvedStaffUserId };
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function record(raw: string): StoredDraft | null {
  const value: unknown = JSON.parse(raw);
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as StoredDraft) : null;
}

export function keyFor(identity: ServerTableRoundDraftIdentity, scope: ServerTableRoundDraftScope): string {
  const parts = [scope.tenantId, scope.staffUserId, identity.tableId, identity.serviceSessionId];
  return `${SCOPED_SERVER_TABLE_ROUND_DRAFT_PREFIX}${encodeURIComponent(JSON.stringify(parts))}`;
}

export function ownsRecord(
  value: StoredDraft,
  identity: ServerTableRoundDraftIdentity,
  scope: ServerTableRoundDraftScope,
): boolean {
  return (
    value.version === SERVER_TABLE_ROUND_DRAFT_VERSION &&
    value.tenantId === scope.tenantId &&
    value.staffUserId === scope.staffUserId &&
    value.tableId === identity.tableId &&
    value.serviceSessionId === identity.serviceSessionId &&
    Array.isArray(value.items)
  );
}

export function isClearlyForeignRecord(
  value: StoredDraft,
  identity: ServerTableRoundDraftIdentity,
  scope: ServerTableRoundDraftScope,
): boolean {
  return (
    (text(value.tableId) !== undefined && value.tableId !== identity.tableId) ||
    (text(value.serviceSessionId) !== undefined && value.serviceSessionId !== identity.serviceSessionId) ||
    (text(value.tenantId) !== undefined && value.tenantId !== scope.tenantId) ||
    (text(value.staffUserId) !== undefined && value.staffUserId !== scope.staffUserId)
  );
}

export function restore(
  raw: string,
  identity: ServerTableRoundDraftIdentity,
  scope: ServerTableRoundDraftScope,
): RestoredDraft {
  const value = record(raw);
  if (!value || !ownsRecord(value, identity, scope)) return { kind: 'invalid' };
  const clientOperationId = text(value.clientOperationId);
  const expiresAt = typeof value.expiresAt === 'number' ? value.expiresAt : 0;
  if (expiresAt <= Date.now()) {
    if (!clientOperationId) return { kind: 'expired' };
    const normalizedValue = JSON.stringify({
      version: SERVER_TABLE_ROUND_DRAFT_VERSION,
      tableId: identity.tableId,
      serviceSessionId: identity.serviceSessionId,
      ...scope,
      items: [],
      notes: '',
      clientOperationId,
      expiresAt: 0,
    });
    return {
      kind: 'valid',
      normalizedValue,
      draft: {
        tableId: identity.tableId,
        serviceSessionId: identity.serviceSessionId,
        items: [],
        notes: '',
        customer: readStaffCustomerSelection(value.customer),
        clientOperationId,
      },
    };
  }
  return {
    kind: 'valid',
    draft: {
      tableId: identity.tableId,
      serviceSessionId: identity.serviceSessionId,
      items: decodeServerTableRoundItems(value.items as unknown[]),
      notes: typeof value.notes === 'string' ? value.notes : '',
      customer: readStaffCustomerSelection(value.customer),
      clientOperationId,
    },
  };
}
