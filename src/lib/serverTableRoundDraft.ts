import type { OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';
import { readStaffCustomerSelection } from '@/types/staffCustomer';
import { decodeServerTableRoundItems } from './serverTableRoundDraftCodec';

export const SERVER_TABLE_ROUND_DRAFT_VERSION = 1;
export const SERVER_TABLE_ROUND_DRAFT_TTL_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'server.table-round-draft';

export interface ServerTableRoundDraft {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly items: OrderItem[];
  readonly notes: string;
  readonly customer?: StaffCustomerSelection;
  readonly clientOperationId?: string;
}

type StoredDraft = Record<string, unknown>;

export type ServerTableRoundDraftScope = { readonly tenantId: string; readonly staffUserId: string };

function readAuthenticatedStaffUserId(): string | undefined {
  try {
    const raw = window.localStorage.getItem('user');
    if (!raw) return undefined;
    const user = JSON.parse(raw) as { email?: unknown };
    return text(user.email)?.toLowerCase();
  } catch (error: unknown) {
    console.warn('Could not read the authenticated staff identity for round recovery', error);
    return undefined;
  }
}

export function getServerTableRoundDraftScope(staffUserId?: string): ServerTableRoundDraftScope | null {
  if (typeof window === 'undefined') return null;
  const tenantId = text(window.location.hostname)?.toLowerCase();
  const resolvedStaffUserId = text(staffUserId)?.toLowerCase() ?? readAuthenticatedStaffUserId();
  if (!tenantId || !resolvedStaffUserId) return null;
  return { tenantId, staffUserId: resolvedStaffUserId };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function readServerTableRoundDraft(
  tableId: string,
  serviceSessionId: string,
  staffUserId?: string,
): ServerTableRoundDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredDraft;
    const scope = getServerTableRoundDraftScope(staffUserId);
    const expiresAt = typeof value.expiresAt === 'number' ? value.expiresAt : 0;
    if (
      value.version !== SERVER_TABLE_ROUND_DRAFT_VERSION ||
      value.tableId !== tableId ||
      value.serviceSessionId !== serviceSessionId ||
      !scope ||
      value.tenantId !== scope.tenantId ||
      value.staffUserId !== scope.staffUserId ||
      !Array.isArray(value.items)
    ) {
      clearServerTableRoundDraft();
      return null;
    }
    const clientOperationId = text(value.clientOperationId);
    if (expiresAt <= Date.now()) {
      if (!clientOperationId) {
        clearServerTableRoundDraft();
        return null;
      }
      // Expire order contents and free text, but retain the idempotency marker until the user
      // reconciles/discards it, signs out, or the authoritative table session closes.
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: SERVER_TABLE_ROUND_DRAFT_VERSION,
          tableId,
          serviceSessionId,
          ...scope,
          items: [],
          notes: '',
          clientOperationId,
          expiresAt: 0,
        }),
      );
      return {
        tableId,
        serviceSessionId,
        items: [],
        notes: '',
        customer: readStaffCustomerSelection(value.customer),
        clientOperationId,
      };
    }
    return {
      tableId,
      serviceSessionId,
      items: decodeServerTableRoundItems(value.items),
      notes: typeof value.notes === 'string' ? value.notes : '',
      customer: readStaffCustomerSelection(value.customer),
      clientOperationId,
    };
  } catch (error: unknown) {
    console.warn('Could not restore the saved table round draft', error);
    clearServerTableRoundDraft();
    return null;
  }
}

export function persistServerTableRoundDraft(draft: ServerTableRoundDraft, staffUserId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const scope = getServerTableRoundDraftScope(staffUserId);
    if (!scope) return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SERVER_TABLE_ROUND_DRAFT_VERSION,
        ...draft,
        ...scope,
        expiresAt: Date.now() + SERVER_TABLE_ROUND_DRAFT_TTL_MS,
      }),
    );
  } catch (error: unknown) {
    // The in-memory draft remains usable when browser storage is unavailable.
    console.warn('Could not persist the table round draft; keeping it in memory', error);
  }
}

export function clearServerTableRoundDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error: unknown) {
    // Best effort only.
    console.warn('Could not clear the saved table round draft', error);
  }
}
