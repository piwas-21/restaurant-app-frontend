import type { RestaurantInfoDto, UpdateRestaurantInfoCommand } from '@/types/restaurantInfo';
import { toFullUpdateCommand } from '@/services/restaurantInfoCommand';

/**
 * Build the full-upsert command for a palette change (ADR-007). Delegates to
 * the shared builder in services/restaurantInfoCommand so every current field
 * (identity, entrance position, …) rides along — `PUT /api/restaurant-info`
 * wipes any omitted field. Guarded by appearanceCommand.test.ts so a future
 * edit can't silently drop a field and wipe the restaurant's data on save.
 */
export function toUpdateCommand(info: RestaurantInfoDto, themePaletteKey: string | null): UpdateRestaurantInfoCommand {
  return toFullUpdateCommand(info, { themePaletteKey });
}
