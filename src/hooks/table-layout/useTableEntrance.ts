'use client';

import { useCallback, useState } from 'react';

/**
 * Owns the canvas "entrance" marker position and its localStorage
 * persistence. Position is stored as canvas percentages ({ x, y }); a
 * malformed or missing payload silently falls back to the default.
 */
export function useTableEntrance() {
  const [entrancePosition, setEntrancePosition] = useState({ x: 50, y: 10 });

  const loadEntrancePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('entrancePosition');
    if (saved) {
      try {
        const position = JSON.parse(saved);
        setEntrancePosition(position);
      } catch {
        // Use default
      }
    }
  }, []);

  const saveEntrancePosition = useCallback((position: { x: number; y: number }) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('entrancePosition', JSON.stringify(position));
  }, []);

  return { entrancePosition, setEntrancePosition, loadEntrancePosition, saveEntrancePosition };
}
