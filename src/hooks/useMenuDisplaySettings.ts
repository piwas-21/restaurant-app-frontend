'use client';

import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import type { MenuLayout } from '@/types/restaurantInfo';

/**
 * The two per-tenant menu-display settings (mcdoner partner request), read off
 * the public restaurant-info read the chrome already holds in its module cache —
 * the menu page adds no request of its own.
 *
 * **Defaults are the shipped behaviour, in both directions.** While the read is
 * in flight, and on any backend that predates the fields (they are absent on the
 * wire), the answer is `tabs` + no bundles on All. A tenant that never touches
 * the new controls cannot tell this feature exists.
 */
export interface MenuDisplaySettings {
  menuLayout: MenuLayout;
  showBundlesOnAllTab: boolean;
  /** True until the restaurant-info read settles; callers render tabs meanwhile. */
  isLoading: boolean;
}

export function useMenuDisplaySettings(): MenuDisplaySettings {
  const { info, isLoading } = useRestaurantInfo();

  return {
    menuLayout: info?.menuLayout === 'onepage' ? 'onepage' : 'tabs',
    showBundlesOnAllTab: info?.showMenuBundlesOnAllTab === true,
    isLoading,
  };
}
