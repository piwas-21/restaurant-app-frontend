'use client';

import { useEffect, useState } from 'react';
import { getFloorPlan } from '@/services/floorPlanService';
import type { FloorPlanDocument } from '@/types/floorPlan';

export type FloorPlanLoadState = 'loading' | 'ready' | 'error';

/**
 * Fetches the default floor-plan document the guest map renders (the anonymous
 * `GET /api/floorplan`, FLOOR-PLAN-REVAMP §5.2). One fetch on mount; the caller
 * merges live availability onto `document.tables` by id. Surfaces an explicit
 * error state (never a silent empty plan) so the map can offer a retry.
 */
export function useFloorPlanDocument() {
  const [document, setDocument] = useState<FloorPlanDocument | null>(null);
  const [status, setStatus] = useState<FloorPlanLoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getFloorPlan()
      .then((response) => {
        if (!active) {
          return;
        }
        if (response.success && response.data) {
          setDocument(response.data);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return { document, status, retry: () => setReloadKey((k) => k + 1) };
}
