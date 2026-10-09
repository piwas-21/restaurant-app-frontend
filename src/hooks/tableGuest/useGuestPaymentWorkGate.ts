'use client';

import { useCallback, useRef, useState } from 'react';

export function useGuestPaymentWorkGate() {
  const working = useRef(false);
  const idleWaiters = useRef<Array<() => void>>([]);
  const [isWorking, setIsWorking] = useState(false);

  const runExclusive = useCallback(async <T>(operation: () => Promise<T>, blocked: T): Promise<T> => {
    if (working.current) return blocked;
    working.current = true;
    setIsWorking(true);
    try {
      return await operation();
    } finally {
      working.current = false;
      setIsWorking(false);
      idleWaiters.current.splice(0).forEach((resolve) => resolve());
    }
  }, []);

  const waitForIdle = useCallback(async () => {
    if (!working.current) return;
    await new Promise<void>((resolve) => idleWaiters.current.push(resolve));
  }, []);

  return { isWorking, runExclusive, waitForIdle };
}
