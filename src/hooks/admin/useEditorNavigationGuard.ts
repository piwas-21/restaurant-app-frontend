'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuVersionPrefill } from '@/utils/quickMenuVersionPayload';

interface EditorNavigationGuardOptions {
  readonly isDirty: boolean;
  readonly onBack: () => void;
  readonly onOfferCreateRequested?: (prefill: MenuVersionPrefill) => void;
  readonly onDelete?: () => void;
  readonly onNavigate?: (href: string) => void;
}

/** Keeps every editor exit behind the same dirty-state confirmation. */
export function useEditorNavigationGuard({
  isDirty,
  onBack,
  onOfferCreateRequested,
  onDelete,
  onNavigate,
}: EditorNavigationGuardOptions) {
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const restoringPopstate = useRef(false);
  const allowPopstate = useRef(false);

  const requestNavigation = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      pendingNavigation.current = action;
      setIsDiscardOpen(true);
    },
    [isDirty],
  );

  useEffect(() => {
    if (!isDirty) return undefined;

    /**
     * App Router does not expose Pages Router's `beforePopState`. A browser Back therefore
     * changes the URL before React gets a chance to render the confirmation, and
     * `beforeunload` never runs for that in-app transition. Move the history cursor back to the
     * editor immediately, then replay the Back only after the admin confirms.
     */
    const handlePopState = (event: PopStateEvent) => {
      if (allowPopstate.current) {
        allowPopstate.current = false;
        return;
      }
      if (restoringPopstate.current) {
        restoringPopstate.current = false;
        event.stopImmediatePropagation();
        return;
      }

      // The App Router also listens for popstate. Capture and stop the original event before it
      // can unmount the editor; the replayed event below is allowed through only after confirmation.
      event.stopImmediatePropagation();
      restoringPopstate.current = true;
      window.history.forward();
      pendingNavigation.current = () => {
        restoringPopstate.current = false;
        allowPopstate.current = true;
        window.history.back();
      };
      setIsDiscardOpen(true);
    };

    window.addEventListener('popstate', handlePopState, true);
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // preventDefault is the supported way to request the browser's native unsaved-changes
      // prompt; assigning returnValue is deprecated and no longer needed by current browsers.
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      restoringPopstate.current = false;
      allowPopstate.current = false;
    };
  }, [isDirty]);

  const handleBack = useCallback(() => requestNavigation(onBack), [onBack, requestNavigation]);
  const handleOfferCreate = onOfferCreateRequested
    ? (prefill: MenuVersionPrefill) => requestNavigation(() => onOfferCreateRequested(prefill))
    : undefined;
  const handleDelete = onDelete ? () => requestNavigation(onDelete) : undefined;
  const handleOfferNavigate = onNavigate ? (href: string) => requestNavigation(() => onNavigate(href)) : undefined;

  const confirmDiscard = useCallback(() => {
    setIsDiscardOpen(false);
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    action?.();
  }, []);

  return {
    isDiscardOpen,
    closeDiscard: () => {
      pendingNavigation.current = null;
      setIsDiscardOpen(false);
    },
    confirmDiscard,
    handleBack,
    handleDelete,
    handleOfferCreate,
    handleOfferNavigate,
  };
}
