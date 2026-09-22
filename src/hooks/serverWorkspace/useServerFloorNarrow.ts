'use client';

import { useEffect, useState } from 'react';

/** Matches phones only; tablets keep the spatial map and desktop workspace. */
export function useServerFloorNarrow(): boolean | null {
  // `null` keeps the server render and the first browser render identical;
  // the responsive default is applied only after matchMedia is available.
  const [isNarrow, setIsNarrow] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setIsNarrow(false);
      return;
    }
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return isNarrow;
}
