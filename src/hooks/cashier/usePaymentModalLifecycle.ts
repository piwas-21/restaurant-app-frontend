import { useEffect, useRef } from 'react';
import type { OrderDto } from '@/types/order';

/** Keeps payment form state tied to its order and ignores completion after unmount. */
export function usePaymentModalLifecycle(
  isOpen: boolean,
  order: OrderDto | null,
  resetOperation: () => void,
  setTransactionId: (value: string) => void,
): { aliveRef: { current: boolean }; openRef: { current: boolean } } {
  const initializedOrderIdRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const openRef = useRef(isOpen);

  useEffect(() => {
    if (!isOpen || !order || initializedOrderIdRef.current === order.id) return;
    if (initializedOrderIdRef.current !== null) resetOperation();
    initializedOrderIdRef.current = order.id;
    setTransactionId(order.orderNumber || order.id || '');
  }, [isOpen, order, resetOperation, setTransactionId]);

  useEffect(() => {
    openRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  return { aliveRef, openRef };
}
