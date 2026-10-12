'use client';

import { useEffect, useRef } from 'react';

/** Show payment review and outcome in the active scroll pane, without leaving the user at its bottom. */
export function usePaymentReviewFocus(operationId: string, state: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    ref.current?.focus({ preventScroll: true });
  }, [operationId, state]);
  return ref;
}
