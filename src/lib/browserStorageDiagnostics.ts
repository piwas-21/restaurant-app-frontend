type StorageOperation =
  | 'read consent preference'
  | 'write consent preference'
  | 'remove consent preference'
  | 'clear legacy locale cache'
  | 'read locale preference'
  | 'persist locale preference'
  | 'read theme preference'
  | 'persist theme preference';

/** Report blocked browser persistence without logging stored values or the exception message. */
export function reportBrowserStorageFailure(operation: StorageOperation, error: unknown): void {
  const errorType = error instanceof Error ? error.name : 'UnknownError';
  console.warn(`Browser storage could not ${operation} (${errorType}); continuing without persistence.`);
}
