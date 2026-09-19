import { useCallback, useEffect, useRef } from 'react';

/** Keeps one operation id across an unchanged tender retry. Call reset when its payload changes. */
export function usePaymentOperationKey(initialOperationId?: string) {
  const operationId = useRef<string | undefined>(initialOperationId);

  // A pending operation may have been restored from sessionStorage after a reload. Do not mint a
  // second key while that outcome is being reconciled.
  useEffect(() => {
    if (initialOperationId && !operationId.current) operationId.current = initialOperationId;
  }, [initialOperationId]);

  const operationFor = useCallback(() => (operationId.current ??= crypto.randomUUID()), []);
  const resetOperation = useCallback(() => {
    operationId.current = undefined;
  }, []);

  return { operationFor, resetOperation };
}
