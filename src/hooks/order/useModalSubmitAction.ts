'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiError } from '@/hooks/useApiError';

/** One save at a time; late completions belong to the opening that started them. */
export function useModalSubmitAction<T>(
  isOpen: boolean,
  collect: () => Promise<T | null>,
  onConfirm: (value: T) => void,
) {
  const { message, capture, clear } = useApiError();
  const opening = useRef(0);
  const mounted = useRef(true);
  const open = useRef(isOpen);
  if (open.current !== isOpen) {
    opening.current += 1;
    open.current = isOpen;
  }
  const pending = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      opening.current += 1;
    };
  }, []);

  const submit = useCallback(async () => {
    if (!open.current || pending.current) return;
    const token = opening.current;
    pending.current = true;
    setIsSubmitting(true);
    clear();
    try {
      const value = await collect();
      if (value !== null && mounted.current && open.current && opening.current === token) onConfirm(value);
    } catch (error) {
      if (mounted.current && open.current && opening.current === token) capture(error);
    } finally {
      pending.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  }, [collect, onConfirm, capture, clear]);

  return { submit, isSubmitting, errorMessage: message };
}
