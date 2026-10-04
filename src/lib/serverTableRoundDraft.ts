import {
  getServerTableRoundDraftScope,
  isClearlyForeignRecord,
  keyFor,
  LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY,
  ownsRecord,
  record,
  restore,
  SCOPED_SERVER_TABLE_ROUND_DRAFT_PREFIX,
  SERVER_TABLE_ROUND_DRAFT_TTL_MS,
  SERVER_TABLE_ROUND_DRAFT_VERSION,
  type ServerTableRoundDraft,
  type ServerTableRoundDraftIdentity,
  type ServerTableRoundDraftScope,
} from './serverTableRoundDraftStorageCodec';

export {
  getServerTableRoundDraftScope,
  SERVER_TABLE_ROUND_DRAFT_TTL_MS,
  SERVER_TABLE_ROUND_DRAFT_VERSION,
} from './serverTableRoundDraftStorageCodec';
export type {
  ServerTableRoundDraft,
  ServerTableRoundDraftIdentity,
  ServerTableRoundDraftScope,
} from './serverTableRoundDraftStorageCodec';

export type ServerTableRoundDraftRead =
  { readonly status: 'available'; readonly draft: ServerTableRoundDraft | null } | { readonly status: 'blocked' };

function available(draft: ServerTableRoundDraft | null): ServerTableRoundDraftRead {
  return { status: 'available', draft };
}

function removeLegacyIfOwned(identity: ServerTableRoundDraftIdentity, scope: ServerTableRoundDraftScope): void {
  const raw = window.sessionStorage.getItem(LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY);
  if (!raw) return;
  const value = record(raw);
  if (value && ownsRecord(value, identity, scope)) {
    window.sessionStorage.removeItem(LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY);
  }
}

function clearScopedDraft(identity: ServerTableRoundDraftIdentity, scope: ServerTableRoundDraftScope): void {
  window.sessionStorage.removeItem(keyFor(identity, scope));
  removeLegacyIfOwned(identity, scope);
}

export function readServerTableRoundDraftStatus(
  tableId: string,
  serviceSessionId: string,
  staffUserId?: string,
): ServerTableRoundDraftRead {
  if (typeof window === 'undefined') return { status: 'blocked' };
  const identity = { tableId, serviceSessionId, staffUserId };
  try {
    const scope = getServerTableRoundDraftScope(staffUserId);
    if (!scope) return { status: 'blocked' };
    const scopedKey = keyFor(identity, scope);
    const scopedRaw = window.sessionStorage.getItem(scopedKey);
    if (scopedRaw !== null) {
      const restored = restore(scopedRaw, identity, scope);
      if (restored.kind === 'invalid') return { status: 'blocked' };
      if (restored.kind === 'expired') {
        window.sessionStorage.removeItem(scopedKey);
        return available(null);
      }
      if (restored.normalizedValue) window.sessionStorage.setItem(scopedKey, restored.normalizedValue);
      return available(restored.draft);
    }

    const legacyRaw = window.sessionStorage.getItem(LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY);
    if (legacyRaw === null) return available(null);
    const legacyValue = record(legacyRaw);
    if (!legacyValue) return { status: 'blocked' };
    if (isClearlyForeignRecord(legacyValue, identity, scope)) return available(null);
    const restored = restore(legacyRaw, identity, scope);
    if (restored.kind === 'invalid') return { status: 'blocked' };
    if (restored.kind === 'expired') {
      window.sessionStorage.removeItem(LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY);
      return available(null);
    }
    window.sessionStorage.setItem(scopedKey, restored.normalizedValue ?? legacyRaw);
    window.sessionStorage.removeItem(LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY);
    return available(restored.draft);
  } catch (error: unknown) {
    console.warn('Could not restore the saved table round draft', error);
    return { status: 'blocked' };
  }
}

export function readServerTableRoundDraft(
  tableId: string,
  serviceSessionId: string,
  staffUserId?: string,
): ServerTableRoundDraft | null {
  const result = readServerTableRoundDraftStatus(tableId, serviceSessionId, staffUserId);
  return result.status === 'available' ? result.draft : null;
}

export function persistServerTableRoundDraft(draft: ServerTableRoundDraft, staffUserId?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const identity = { tableId: draft.tableId, serviceSessionId: draft.serviceSessionId, staffUserId };
    const scope = getServerTableRoundDraftScope(staffUserId);
    if (!scope) return false;
    window.sessionStorage.setItem(
      keyFor(identity, scope),
      JSON.stringify({
        version: SERVER_TABLE_ROUND_DRAFT_VERSION,
        ...draft,
        ...scope,
        expiresAt: Date.now() + SERVER_TABLE_ROUND_DRAFT_TTL_MS,
      }),
    );
    return true;
  } catch (error: unknown) {
    console.warn('Could not persist the table round draft', error);
    return false;
  }
}

export function clearServerTableRoundDraft(identity?: ServerTableRoundDraftIdentity): void {
  if (typeof window === 'undefined') return;
  try {
    if (identity) {
      const scope = getServerTableRoundDraftScope(identity.staffUserId);
      if (scope) clearScopedDraft(identity, scope);
      return;
    }
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
      window.sessionStorage.key(index),
    ).filter(
      (key): key is string =>
        key === LEGACY_SERVER_TABLE_ROUND_DRAFT_KEY || Boolean(key?.startsWith(SCOPED_SERVER_TABLE_ROUND_DRAFT_PREFIX)),
    );
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch (error: unknown) {
    console.warn('Could not clear the saved table round draft', error);
  }
}

export function expireServerTableRoundDraft(identity: ServerTableRoundDraftIdentity): void {
  if (typeof window === 'undefined') return;
  try {
    const result = readServerTableRoundDraftStatus(identity.tableId, identity.serviceSessionId, identity.staffUserId);
    if (result.status !== 'available' || !result.draft) return;
    const draft = result.draft;
    const scope = getServerTableRoundDraftScope(identity.staffUserId);
    if (!scope) return;
    if (!draft.clientOperationId) {
      clearScopedDraft(identity, scope);
      return;
    }
    window.sessionStorage.setItem(
      keyFor(identity, scope),
      JSON.stringify({
        version: SERVER_TABLE_ROUND_DRAFT_VERSION,
        tableId: identity.tableId,
        serviceSessionId: identity.serviceSessionId,
        ...scope,
        items: [],
        notes: '',
        clientOperationId: draft.clientOperationId,
        expiresAt: 0,
      }),
    );
  } catch (error: unknown) {
    console.warn('Could not expire the saved table round draft', error);
  }
}
