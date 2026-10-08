export interface CapturedAttempt {
  readonly attemptId: string;
  readonly operationId: string;
  readonly mode: string;
  readonly amountMinor: number;
}

export interface StoredAttemptActor {
  readonly attempt_id: string;
  readonly operation_id: string;
  readonly actor_id: string;
  readonly actor_kind: string;
  readonly state: string;
  readonly journal_attempt_id: string | null;
}

export function assertPaymentAttemptActors(
  actorRows: readonly StoredAttemptActor[],
  attempts: readonly CapturedAttempt[],
  releasedCashierOperationId: string,
): void {
  if (new Set(attempts.map((attempt) => attempt.attemptId)).size !== attempts.length)
    throw new Error('The expected guest attempts are not unique.');
  if (actorRows.length !== attempts.length + 1)
    throw new Error('The session contains an unexpected number of payment attempts.');

  const guestRows = attempts.map((expected) => {
    const matches = actorRows.filter((row) => row.attempt_id === expected.attemptId);
    if (matches.length !== 1) throw new Error('An expected guest attempt is missing or duplicated.');
    const [row] = matches;
    if (
      row.operation_id !== expected.operationId ||
      row.actor_kind !== 'GuestParticipant' ||
      row.state !== 'Captured' ||
      row.journal_attempt_id !== expected.attemptId
    )
      throw new Error('A captured attempt does not match its expected guest evidence.');
    return row;
  });
  if (new Set(guestRows.map((row) => row.actor_id)).size !== attempts.length)
    throw new Error('Captured guest attempts must have distinct participant actors.');

  const releasedCashierRows = actorRows.filter((row) => row.operation_id === releasedCashierOperationId);
  if (releasedCashierRows.length !== 1) throw new Error('The known released cashier attempt is missing or duplicated.');
  const [releasedCashier] = releasedCashierRows;
  if (
    releasedCashier.actor_kind !== 'Staff' ||
    releasedCashier.state !== 'Released' ||
    releasedCashier.journal_attempt_id !== null ||
    guestRows.some((row) => row.attempt_id === releasedCashier.attempt_id)
  )
    throw new Error('The known cashier attempt is not a separate released staff attempt without a journal.');
}
