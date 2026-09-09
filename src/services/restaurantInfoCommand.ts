import type { RestaurantInfoDto, UpdateRestaurantInfoCommand } from '@/types/restaurantInfo';

/**
 * Single builder for the `PUT /api/restaurant-info` command. The endpoint is a
 * FULL upsert — the backend assigns every field unconditionally, so any field a
 * writer omits is wiped on the singleton. Every writer (general settings,
 * appearance/palette) MUST build its command here,
 * passing only the field(s) it changes via `overrides`; base values come from
 * the current server state so unrelated fields always ride along.
 *
 * Guarded by appearanceCommand.test.ts (exact-key-set assertion): adding a
 * field to UpdateRestaurantInfoCommand without adding it here fails the build
 * (type error) AND the guard test, so no writer can silently wipe it.
 */
export function toFullUpdateCommand(
  info: RestaurantInfoDto,
  overrides: Partial<UpdateRestaurantInfoCommand> = {},
): UpdateRestaurantInfoCommand {
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
    // Menu-display settings (mcdoner partner request): the PUT is a full upsert,
    // so these ride along from the current server state like every other field.
    // `??` covers a backend that predates the fields on the READ side only; the
    // fallbacks are the shipped defaults (tabs layout, products-only All tab).
    menuLayout: info.menuLayout ?? 'tabs',
    showMenuBundlesOnAllTab: info.showMenuBundlesOnAllTab ?? false,
    ...overrides,
  };
}
