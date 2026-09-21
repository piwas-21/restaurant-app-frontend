'use client';

import { useEffect, useState } from 'react';

/** Matches the staff workspace's single-pane breakpoint without coupling layout to a router. */
export function useServerFloorNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return isNarrow;
}
