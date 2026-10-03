const SAFE_ERROR_NAMES = new Set([
  'AbortError',
  'ApiError',
  'Error',
  'InvalidStateError',
  'NetworkError',
  'NotAllowedError',
  'QuotaExceededError',
  'SecurityError',
  'SyntaxError',
  'TimeoutError',
  'TypeError',
]);

export type TableGuestFailureOperation =
  | 'clear table context'
  | 'create admission code'
  | 'read account'
  | 'read public feature'
  | 'read pending round'
  | 'read visit state'
  | 'read visit state presence'
  | 'remove pending round'
  | 'remove visit after failed write'
  | 'replace visit state'
  | 'save pending round'
  | 'store blocked visit state'
  | 'join visit'
  | 'parse visit state'
  | 'leave visit';

/** Report a safe operation and an allowlisted error class without logging tokens, messages, or stored values. */
export function reportTableGuestFailure(operation: TableGuestFailureOperation, error: unknown): void {
  const errorName = error instanceof Error && SAFE_ERROR_NAMES.has(error.name) ? error.name : 'OtherError';
  console.warn(`Table guest ${operation} failed (${errorName}); the safe recovery state is retained.`);
}
