import { useEffect } from 'react';

/** Keep browser Back from abandoning an in-flight staff operation with an unknown outcome. */
export function useStaffNavigationLock(navigationDisabled: boolean) {
  useEffect(() => {
    if (!navigationDisabled || typeof window === 'undefined') return;
    const guardedUrl = window.location.href;
    const preventPopState = (event: PopStateEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.history.pushState(window.history.state, '', guardedUrl);
    };
    window.addEventListener('popstate', preventPopState, true);
    return () => window.removeEventListener('popstate', preventPopState, true);
  }, [navigationDisabled]);
}
