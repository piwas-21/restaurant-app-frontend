type RecoveryOperation =
  | 'check order payment'
  | 'check visit tender'
  | 'read table recovery'
  | 'preview table recovery'
  | 'clear order payment journal'
  | 'save account payment journal'
  | 'clear account payment journal';

/** Keep exception messages, operation IDs and stored payment data out of diagnostics. */
export function reportCashierRecoveryFailure(operation: RecoveryOperation, error: unknown): void {
  const errorKind = error instanceof Error ? 'Error' : 'UnknownError';
  console.warn(`Cashier recovery could not ${operation} (${errorKind}); the recovery guard remains active.`);
}
