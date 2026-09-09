import type { MenuLayout, RestaurantInfoDto, UpdateRestaurantInfoCommand } from '@/types/restaurantInfo';
import { toFullUpdateCommand } from '@/services/restaurantInfoCommand';

/** The menu-display section's own choices, saved with the palette through one full-upsert PUT. */
export interface MenuDisplaySettingsInput {
  menuLayout: MenuLayout;
  showBundlesOnAllTab: boolean;
}

/**
 * Build the full-upsert command for the Appearance tab (ADR-007). Delegates to
 * the shared builder in services/restaurantInfoCommand so every current field
 * (identity, address, contact, menu display, …) rides along — `PUT
 * /api/restaurant-info` wipes any omitted field. Guarded by
 * appearanceCommand.test.ts so a future edit can't silently drop a field and
 * wipe the restaurant's data on save.
 */
export function toUpdateCommand(
  info: RestaurantInfoDto,
  themePaletteKey: string | null,
  menuDisplay: MenuDisplaySettingsInput,
): UpdateRestaurantInfoCommand {
  return toFullUpdateCommand(info, {
    themePaletteKey,
    menuLayout: menuDisplay.menuLayout,
    showMenuBundlesOnAllTab: menuDisplay.showBundlesOnAllTab,
  });
}
