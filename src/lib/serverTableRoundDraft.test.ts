import {
  clearServerTableRoundDraft,
  persistServerTableRoundDraft,
  readServerTableRoundDraft,
  SERVER_TABLE_ROUND_DRAFT_TTL_MS,
} from './serverTableRoundDraft';

const draft = {
  tableId: 'T-QA/3',
  serviceSessionId: 'session-1',
  items: [{ product: { id: 'p1', name: 'Soup' }, quantity: 2, unitPrice: 8, selectedIngredientIds: [] }],
  notes: 'no onions',
  clientOperationId: 'operation-1',
};

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
    expect(readServerTableRoundDraft('T-QA/3', 'session-1', 'server@example.test')).toBeNull();
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
