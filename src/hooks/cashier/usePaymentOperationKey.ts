import { useRef } from 'react';

/** Keeps one operation id across an unchanged tender retry. Call reset when its payload changes. */
export function usePaymentOperationKey() {
  const operationId = useRef<string | undefined>(undefined);
  return {
    operationFor: () => (operationId.current ??= crypto.randomUUID()),
    resetOperation: () => {
      operationId.current = undefined;
    },
  };
}
