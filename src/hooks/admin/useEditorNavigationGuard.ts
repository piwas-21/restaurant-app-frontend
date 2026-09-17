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
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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
    closeDiscard: () => setIsDiscardOpen(false),
    confirmDiscard,
    handleBack,
    handleDelete,
    handleOfferCreate,
    handleOfferNavigate,
  };
}
