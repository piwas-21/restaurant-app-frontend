'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { DEFAULT_ENTRANCE_POSITION } from '@/lib/tableCanvasGeometry';
import { toFullUpdateCommand } from '@/services/restaurantInfoCommand';
import { getRestaurantInfo, updateRestaurantInfo } from '@/services/restaurantInfoService';

export interface EntrancePosition {
  x: number;
  y: number;
}

/**
 * Owns the canvas "entrance" marker position, persisted on the RestaurantInfo
 * singleton (`entrancePositionX`/`entrancePositionY`, canvas percentages) so
 * customers see the admin-placed position. Falls back to the shared default
 * until the backend exposes the fields (additive contract) or they are set.
 * A failed save reverts the marker to the last server-confirmed position.
 */
export function useTableEntrance(showMessage?: (type: 'success' | 'error', text: string) => void) {
  const { t } = useTranslation();
  const [entrancePosition, setEntrancePosition] = useState<EntrancePosition>({ ...DEFAULT_ENTRANCE_POSITION });
  // Last position the server confirmed (loaded or successfully saved) — the
  // revert target when a save fails, so the canvas never shows unsaved state.
  const lastPersistedPosition = useRef<EntrancePosition>({ ...DEFAULT_ENTRANCE_POSITION });

  const loadEntrancePosition = useCallback(async () => {
    try {
      const response = await getRestaurantInfo();
      const info = response.data;
      if (info?.entrancePositionX != null && info.entrancePositionY != null) {
        const position = { x: info.entrancePositionX, y: info.entrancePositionY };
        lastPersistedPosition.current = position;
        setEntrancePosition(position);
      }
    } catch {
      // Keep the default so the canvas still renders, but tell the admin —
      // a silently stale entrance would get re-saved as truth.
      showMessage?.('error', t('general_settings_load_failed', 'Failed to load restaurant info'));
    }
  }, [showMessage, t]);

  const saveEntrancePosition = useCallback(
    async (position: EntrancePosition) => {
      const fallbackMessage = t('failed_to_save_layout', 'Failed to save layout');
      try {
        const response = await getRestaurantInfo();
        const info = response.data;
        if (!info) throw new Error(fallbackMessage);
        const result = await updateRestaurantInfo(
          toFullUpdateCommand(info, { entrancePositionX: position.x, entrancePositionY: position.y }),
        );
        if (!result.success) throw new Error(result.message || fallbackMessage);
        lastPersistedPosition.current = position;
        invalidateRestaurantInfoCache();
      } catch (err) {
        setEntrancePosition({ ...lastPersistedPosition.current });
        const message = err instanceof Error && err.message ? err.message : fallbackMessage;
        showMessage?.('error', message);
      }
    },
    [showMessage, t],
  );

  return { entrancePosition, setEntrancePosition, loadEntrancePosition, saveEntrancePosition };
}
