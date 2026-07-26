'use client';

import { useEffect } from 'react';

/**
 * The browser's own unsaved-changes prompt, armed while `dirty` (FLOOR-PLAN-REVAMP
 * §4.3). Autosave shrinks the window in which work is only in the browser but
 * never removes it, so a reload or a tab-close landing inside that window still
 * has to be questioned.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) {
      return;
    }
    // Calling preventDefault triggers the prompt — the modern replacement for
    // the deprecated `event.returnValue`.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
