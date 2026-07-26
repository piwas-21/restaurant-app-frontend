/**
 * Per-order-type catalog availability, as the SERVER resolved it.
 *
 * Mirrors `RestaurantSystem.Api/Features/Catalog/Dtos/ItemAvailabilityDto.cs`. The backend computes
 * one answer to "can the guest order this right now, and if not why?" precisely so no client
 * re-derives precedence from `IsActive`/`IsAvailable`/schedule/channel and ends up telling a guest to
 * "switch to Takeaway" for an item that is switched off on every channel
 * (ORDER-TYPE-AVAILABILITY-PLAN §4.2).
 *
 * ⚠️ Customer surfaces read `allowedOrderTypes` — the server-DECODED list. They must never decode a
 * raw `OrderChannels` mask: the bits are 1/2/4 while `OrderType` is 1/2/3, and `src/utils/
 * orderChannels.ts` exists for the ADMIN editors that have to round-trip the stored value.
 */

import type { OrderType } from '@/types/order';

/**
 * Why an item cannot be ordered. Mirrors `Domain/Common/Enums/AvailabilityReason.cs`, which the API
 * serializes as a STRING (`Program.cs` registers `StringEnumConverterFactory`).
 *
 * `Unavailable` is a manual admin toggle, NOT "sold out" — this system has no stock concept, so no
 * copy built from it may imply inventory.
 */
export type AvailabilityReason = 'Available' | 'Unavailable' | 'WrongOrderType';

export interface ItemAvailability {
  /** True when the item can be added to the basket for the order type the fetch asked about. */
  canOrder: boolean;
  reason: AvailabilityReason;
  /**
   * Every order type this item IS available on. Drives the customer chip and the "Switch to X" CTA.
   * Unrestricted items list all three.
   */
  allowedOrderTypes: OrderType[];
}
