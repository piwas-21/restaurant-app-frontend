'use client';

import { useCallback, useRef, useState, type FormEventHandler } from 'react';

interface UseEditorPreSaveReviewOptions {
  readonly formId: string;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
}

/** Place a concise review between the page's Save action and its existing form write. */
export function useEditorPreSaveReview({ formId, onSubmit }: UseEditorPreSaveReviewOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const approvedSubmit = useRef(false);

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    (event) => {
      if (approvedSubmit.current) {
        approvedSubmit.current = false;
        void onSubmit(event);
        return;
      }
      event.preventDefault();
      setIsOpen(true);
    },
    [onSubmit],
  );

  const confirm = useCallback(() => {
    approvedSubmit.current = true;
    setIsOpen(false);
    queueMicrotask(() => {
      const form = document.getElementById(formId);
      if (form instanceof HTMLFormElement) form.requestSubmit();
      else approvedSubmit.current = false;
    });
  }, [formId]);

  return {
    isOpen,
    handleSubmit,
    confirm,
    close: useCallback(() => setIsOpen(false), []),
  };
}

export default useEditorPreSaveReview;
