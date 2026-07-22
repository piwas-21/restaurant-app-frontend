'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { DEFAULT_ENTRANCE_POSITION } from '@/lib/tableCanvasGeometry';
import { getRestaurantInfo, updateRestaurantInfo } from '@/services/restaurantInfoService';
import type { RestaurantInfoDto, UpdateRestaurantInfoCommand } from '@/types/restaurantInfo';

export interface EntrancePosition {
  x: number;
  y: number;
}

function toUpdateCommand(info: RestaurantInfoDto, position: EntrancePosition): UpdateRestaurantInfoCommand {
  return {
    name: info.name,
    addressLine1: info.addressLine1,
    addressLine2: info.addressLine2,
    city: info.city,
    postalCode: info.postalCode,
    country: info.country,
    latitude: info.latitude,
    longitude: info.longitude,
    email: info.email,
    website: info.website,
    themePaletteKey: info.themePaletteKey,
    entrancePositionX: position.x,
    entrancePositionY: position.y,
  };
}

/**
 * Owns the canvas "entrance" marker position, persisted on the RestaurantInfo
 * singleton (`entrancePositionX`/`entrancePositionY`, canvas percentages) so
 * customers see the admin-placed position. Falls back to the shared default
 * until the backend exposes the fields (additive contract) or they are set.
 */
export function useTableEntrance(showMessage?: (type: 'success' | 'error', text: string) => void) {
  const { t } = useTranslation();
  const [entrancePosition, setEntrancePosition] = useState<EntrancePosition>({ ...DEFAULT_ENTRANCE_POSITION });

  const loadEntrancePosition = useCallback(async () => {
    try {
      const response = await getRestaurantInfo();
      const info = response.data;
      if (info?.entrancePositionX != null && info.entrancePositionY != null) {
        setEntrancePosition({ x: info.entrancePositionX, y: info.entrancePositionY });
      }
    } catch {
      // Keep the default — the canvas still renders.
    }
  }, []);

  const saveEntrancePosition = useCallback(
    async (position: EntrancePosition) => {
      try {
        const response = await getRestaurantInfo();
        const info = response.data;
        if (!info) throw new Error('Restaurant info unavailable');
        const result = await updateRestaurantInfo(toUpdateCommand(info, position));
        if (!result.success) throw new Error(result.message || 'Update failed');
        invalidateRestaurantInfoCache();
      } catch {
        showMessage?.('error', t('failed_to_save_layout', 'Failed to save layout'));
      }
    },
    [showMessage, t],
  );

  return { entrancePosition, setEntrancePosition, loadEntrancePosition, saveEntrancePosition };
}
