import {
  assertPaymentAttemptActors,
  type CapturedAttempt,
  type StoredAttemptActor,
} from './paymentEvidenceActorChecks';

const capturedGuestAttempt: CapturedAttempt = {
  attemptId: 'guest-attempt',
  operationId: 'guest-operation',
  mode: 'Items',
  amountMinor: 1500,
};

const guestActor: StoredAttemptActor = {
  attempt_id: capturedGuestAttempt.attemptId,
  operation_id: capturedGuestAttempt.operationId,
  actor_id: 'guest-participant',
  actor_kind: 'GuestParticipant',
  state: 'Captured',
  journal_attempt_id: capturedGuestAttempt.attemptId,
};

const releasedCashierActor: StoredAttemptActor = {
  attempt_id: 'cashier-attempt',
  operation_id: 'cashier-operation',
  actor_id: 'cashier-user',
  actor_kind: 'Staff',
  state: 'Released',
  journal_attempt_id: null,
};

describe('P11 payment evidence actor checks', () => {
  test('accepts the captured guest and the known released cashier attempt', () => {
    expect(() => expect([guestActor, releasedCashierActor]).toHaveLength(1)).toThrow();
    expect(() =>
      assertPaymentAttemptActors(
        [guestActor, releasedCashierActor],
        [capturedGuestAttempt],
        releasedCashierActor.operation_id,
      ),
    ).not.toThrow();
  });

  test('rejects a captured attempt attributed to staff', () => {
    const wrongActor = { ...guestActor, actor_kind: 'Staff' };
    expect(() =>
      assertPaymentAttemptActors(
        [wrongActor, releasedCashierActor],
        [capturedGuestAttempt],
        releasedCashierActor.operation_id,
      ),
    ).toThrow();
  });

  test('rejects a checkout journal on the known released cashier attempt', () => {
    const cashierWithJournal = { ...releasedCashierActor, journal_attempt_id: releasedCashierActor.attempt_id };
    expect(() =>
      assertPaymentAttemptActors(
        [guestActor, cashierWithJournal],
        [capturedGuestAttempt],
        releasedCashierActor.operation_id,
      ),
    ).toThrow();
  });

  test('requires each captured guest attempt to have a distinct participant actor', () => {
    const secondAttempt: CapturedAttempt = {
      attemptId: 'second-guest-attempt',
      operationId: 'second-guest-operation',
      mode: 'Amount',
      amountMinor: 501,
    };
    const secondActor: StoredAttemptActor = {
      ...guestActor,
      attempt_id: secondAttempt.attemptId,
      operation_id: secondAttempt.operationId,
      journal_attempt_id: secondAttempt.attemptId,
    };
    expect(() =>
      assertPaymentAttemptActors(
        [guestActor, secondActor, releasedCashierActor],
        [capturedGuestAttempt, secondAttempt],
        releasedCashierActor.operation_id,
      ),
    ).toThrow();
  });

  test('rejects any other attempt in the service session, including one without a journal', () => {
    const unexpectedAttempt: StoredAttemptActor = {
      attempt_id: 'unrelated-attempt',
      operation_id: 'unrelated-operation',
      actor_id: 'unrelated-actor',
      actor_kind: 'GuestParticipant',
      state: 'Processing',
      journal_attempt_id: null,
    };
    expect(() =>
      assertPaymentAttemptActors(
        [guestActor, releasedCashierActor, unexpectedAttempt],
        [capturedGuestAttempt],
        releasedCashierActor.operation_id,
      ),
    ).toThrow();
  });
});
