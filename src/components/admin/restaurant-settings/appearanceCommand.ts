import type { RestaurantInfoDto, UpdateRestaurantInfoCommand } from '@/types/restaurantInfo';

/**
 * Build the full-upsert command for a palette change. `PUT /api/restaurant-info`
 * replaces the whole singleton (the backend wipes any omitted field), so every
 * current identity field must ride along — only `themePaletteKey` changes here
 * (ADR-007). Guarded by appearanceCommand.test.ts so a future edit can't silently
 * drop a field and wipe the restaurant's data on a palette save.
 */
export function toUpdateCommand(info: RestaurantInfoDto, themePaletteKey: string | null): UpdateRestaurantInfoCommand {
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
    themePaletteKey,
  };
}
