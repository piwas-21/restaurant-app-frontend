import {
  clearServerTableRoundDraft,
  persistServerTableRoundDraft,
  readServerTableRoundDraft,
  readServerTableRoundDraftStatus,
  SERVER_TABLE_ROUND_DRAFT_VERSION,
  SERVER_TABLE_ROUND_DRAFT_TTL_MS,
} from './serverTableRoundDraft';

const draft = {
  tableId: 'T-QA/3',
  serviceSessionId: 'session-1',
  items: [{ product: { id: 'p1', name: 'Soup' }, quantity: 2, unitPrice: 8, selectedIngredientIds: [] }],
  notes: 'no onions',
  clientOperationId: 'operation-1',
};
const legacyKey = 'server.table-round-draft';

function storageKeys(): string[] {
  return Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).filter(
    (key): key is string => key !== null,
  );
}

function legacyRecord(overrides: Record<string, unknown> = {}) {
  return {
    version: SERVER_TABLE_ROUND_DRAFT_VERSION,
    ...draft,
    tenantId: window.location.hostname.toLowerCase(),
    staffUserId: 'server@example.test',
    expiresAt: Date.now() + SERVER_TABLE_ROUND_DRAFT_TTL_MS,
    ...overrides,
  };
}

describe('server table round draft', () => {
  beforeEach(() => {
    clearServerTableRoundDraft();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ email: 'server@example.test' }));
  });

  it('restores only for the same stable table and service session', () => {
    persistServerTableRoundDraft(draft);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toMatchObject(draft);
    expect(readServerTableRoundDraft('T-QA/3', 'session-2')).toBeNull();
  });

  it('does not restore a draft for another authenticated staff user', () => {
    persistServerTableRoundDraft(draft);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1', 'other@example.test')).toBeNull();
    expect(readServerTableRoundDraft('T-QA/3', 'session-1', 'server@example.test')).toMatchObject(draft);
  });

  it('keeps independent scoped records recoverable through A to B to A navigation', () => {
    const draftB = {
      ...draft,
      tableId: 'T-QA/4',
      serviceSessionId: 'session-2',
      clientOperationId: 'operation-2',
    };
    persistServerTableRoundDraft(draft);
    persistServerTableRoundDraft(draftB);

    const keys = storageKeys();
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith('server.table-round-draft:scope:'))).toBe(true);
    expect(readServerTableRoundDraft('T-QA/4', 'session-2')?.clientOperationId).toBe('operation-2');
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')?.clientOperationId).toBe('operation-1');
    expect(readServerTableRoundDraft('T-QA/4', 'session-2')?.clientOperationId).toBe('operation-2');
  });

  it('keeps table/session recovery separated across staff identities', () => {
    persistServerTableRoundDraft(draft, 'staff-a@example.test');
    persistServerTableRoundDraft({ ...draft, clientOperationId: 'staff-b-operation' }, 'staff-b@example.test');

    expect(storageKeys()).toHaveLength(2);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1', 'staff-b@example.test')?.clientOperationId).toBe(
      'staff-b-operation',
    );
    expect(readServerTableRoundDraft('T-QA/3', 'session-1', 'staff-a@example.test')?.clientOperationId).toBe(
      'operation-1',
    );
  });

  it('migrates a matching legacy descriptor only after its scoped copy is written', () => {
    const legacy = JSON.stringify(legacyRecord());
    sessionStorage.setItem(legacyKey, legacy);

    expect(readServerTableRoundDraft('T-QA/4', 'session-2')).toBeNull();
    expect(sessionStorage.getItem(legacyKey)).toBe(legacy);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toMatchObject(draft);
    expect(sessionStorage.getItem(legacyKey)).toBeNull();
    expect(storageKeys()).toHaveLength(1);
    const migrated = JSON.parse(sessionStorage.getItem(storageKeys()[0]) ?? '{}') as { clientOperationId?: string };
    expect(migrated.clientOperationId).toBe('operation-1');
  });

  it('migrates an expired legacy descriptor without dropping its operation authority', () => {
    sessionStorage.setItem(legacyKey, JSON.stringify(legacyRecord({ expiresAt: Date.now() - 1 })));

    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toMatchObject({
      tableId: 'T-QA/3',
      serviceSessionId: 'session-1',
      items: [],
      notes: '',
      clientOperationId: 'operation-1',
    });
    expect(sessionStorage.getItem(legacyKey)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(storageKeys()[0]) ?? '{}')).toMatchObject({
      clientOperationId: 'operation-1',
      items: [],
      notes: '',
      expiresAt: 0,
    });
  });

  it('does not migrate or erase a legacy record with another tenant or schema version', () => {
    const foreignTenant = JSON.stringify(legacyRecord({ tenantId: 'another-tenant.example' }));
    sessionStorage.setItem(legacyKey, foreignTenant);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
    expect(sessionStorage.getItem(legacyKey)).toBe(foreignTenant);

    const unsupported = JSON.stringify(legacyRecord({ version: SERVER_TABLE_ROUND_DRAFT_VERSION + 1 }));
    sessionStorage.setItem(legacyKey, unsupported);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
    expect(sessionStorage.getItem(legacyKey)).toBe(unsupported);
  });

  it('blocks on malformed current-scope data instead of treating it as an empty draft', () => {
    persistServerTableRoundDraft(draft);
    const scopedKey = storageKeys().find((key) => key.startsWith('server.table-round-draft:scope:'));
    expect(scopedKey).toBeDefined();
    if (!scopedKey) throw new Error('Expected one scoped recovery record');
    sessionStorage.setItem(scopedKey, '{');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(readServerTableRoundDraftStatus('T-QA/3', 'session-1')).toEqual({ status: 'blocked' });
    expect(sessionStorage.getItem(scopedKey)).toBe('{');
    jest.restoreAllMocks();
  });

  it('blocks when session storage cannot be read', () => {
    const getItem = Storage.prototype.getItem;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (this === window.sessionStorage) throw new Error('storage denied');
      return getItem.call(this, key);
    });

    expect(readServerTableRoundDraftStatus('T-QA/3', 'session-1')).toEqual({ status: 'blocked' });
    jest.restoreAllMocks();
  });

  it('treats a clearly foreign legacy record as absent without deleting it', () => {
    const foreign = JSON.stringify(legacyRecord({ tableId: 'T-QA/4', serviceSessionId: 'session-2' }));
    sessionStorage.setItem(legacyKey, foreign);

    expect(readServerTableRoundDraftStatus('T-QA/3', 'session-1')).toEqual({ status: 'available', draft: null });
    expect(sessionStorage.getItem(legacyKey)).toBe(foreign);
  });

  it('clears only the requested scope while sign-out clears all scoped records', () => {
    const draftB = { ...draft, tableId: 'T-QA/4', serviceSessionId: 'session-2' };
    persistServerTableRoundDraft(draft);
    persistServerTableRoundDraft(draftB);

    clearServerTableRoundDraft({ tableId: draft.tableId, serviceSessionId: draft.serviceSessionId });
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
    expect(readServerTableRoundDraft('T-QA/4', 'session-2')).toMatchObject(draftB);

    clearServerTableRoundDraft();
    expect(readServerTableRoundDraft('T-QA/4', 'session-2')).toBeNull();
  });

  it('expires drafts after the short recovery window', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    persistServerTableRoundDraft({ ...draft, clientOperationId: undefined });
    jest.spyOn(Date, 'now').mockReturnValue(now + SERVER_TABLE_ROUND_DRAFT_TTL_MS + 1);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
    jest.restoreAllMocks();
  });

  it('expires sensitive content but retains an unresolved idempotency marker', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    persistServerTableRoundDraft(draft);
    jest.spyOn(Date, 'now').mockReturnValue(now + SERVER_TABLE_ROUND_DRAFT_TTL_MS + 1);

    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toEqual({
      tableId: 'T-QA/3',
      serviceSessionId: 'session-1',
      items: [],
      notes: '',
      clientOperationId: 'operation-1',
    });
    jest.restoreAllMocks();
  });

  it('requires an authenticated staff identity before persisting', () => {
    localStorage.clear();
    persistServerTableRoundDraft(draft);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
  });

  it('clears the operation id when the caller discards storage', () => {
    persistServerTableRoundDraft(draft);
    clearServerTableRoundDraft();
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
  });
});
