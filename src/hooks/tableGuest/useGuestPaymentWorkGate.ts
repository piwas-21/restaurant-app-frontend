'use client';

import { useCallback, useRef, useState } from 'react';

export function useGuestPaymentWorkGate() {
  const working = useRef(false);
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
    }
  }, []);

  return { isWorking, runExclusive };
}
