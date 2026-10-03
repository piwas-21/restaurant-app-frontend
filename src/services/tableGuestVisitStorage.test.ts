import {
  hasStoredTableGuestState,
  leaveStoredVisitIfNoPendingRound,
  readPendingTableGuestRoundForRecovery,
  readStoredTableGuestState,
} from './tableGuestVisitStorage';

const attempt = {
  serviceSessionId: 'visit-id',
  operationId: 'lost-response-operation',
  expectedAccountRevision: 3,
  expectedBasketFingerprint: 'C'.repeat(64),
};

describe('table guest visit storage', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('distinguishes malformed visit data from inaccessible session storage', () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', '{invalid');
    expect(readStoredTableGuestState()).toEqual({ kind: 'corrupt' });

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError');
    });
    expect(readStoredTableGuestState()).toEqual({ kind: 'storageUnavailable' });
  });

  it('retains a validated operation descriptor without a readable visit credential', () => {
    const rawAttempt = JSON.stringify(attempt);
    sessionStorage.setItem('rumi_table_guest_visit_v1', '{invalid');
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);

    expect(readPendingTableGuestRoundForRecovery()).toEqual({ kind: 'pending', round: attempt });
    expect(leaveStoredVisitIfNoPendingRound()).toBe(false);
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe('{invalid');
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(hasStoredTableGuestState()).toBe(true);
  });

  it('treats malformed or inaccessible pending-round data as unresolved', () => {
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', '{invalid');
    expect(readPendingTableGuestRoundForRecovery()).toEqual({ kind: 'unavailable' });
    expect(leaveStoredVisitIfNoPendingRound()).toBe(false);

    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable.', 'SecurityError');
    });
    expect(readPendingTableGuestRoundForRecovery()).toEqual({ kind: 'unavailable' });
    expect(leaveStoredVisitIfNoPendingRound()).toBe(false);
  });
});
