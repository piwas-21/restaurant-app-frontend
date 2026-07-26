import { OrderType } from '@/types/order';

/**
 * Client mirror of the backend's `OrderChannels` bitmask (`Domain/Common/OrderChannelMap.cs`).
 *
 * The backend stores per-order-type availability as a nullable int mask on categories and products.
 * The API returns the DECODED list wherever a customer needs it (`availability.allowedOrderTypes`,
 * `category.allowedOrderTypes`), so customer surfaces must NOT decode masks themselves. These
 * helpers exist for the ADMIN editors, which have to round-trip the raw mask through checkboxes.
 *
 * ⚠️ The bit values are 1/2/4 and are NOT the backend `OrderType` enum's numeric values (1/2/3) —
 * that mismatch is exactly why the backend forbids direct casts. Always go through this map.
 */
const CHANNEL_BIT: Record<OrderType, number> = {
  [OrderType.DineIn]: 1,
  [OrderType.Takeaway]: 2,
  [OrderType.Delivery]: 4,
};

/** Declaration order — used for stable checkbox/chip ordering everywhere. */
export const ALL_ORDER_TYPES: readonly OrderType[] = [
  OrderType.DineIn,
  OrderType.Takeaway,
  OrderType.Delivery,
] as const;

const ALL_MASK = ALL_ORDER_TYPES.reduce((mask, type) => mask | CHANNEL_BIT[type], 0);

/**
 * Decode a stored mask into order types. `null`/`undefined` means unrestricted, so every order type
 * is returned — the same permissive rule the server applies.
 */
export function orderTypesFromMask(mask: number | null | undefined): OrderType[] {
  if (mask === null || mask === undefined) return [...ALL_ORDER_TYPES];
  return ALL_ORDER_TYPES.filter((type) => (mask & CHANNEL_BIT[type]) !== 0);
}

/**
 * Encode order types into a stored mask. A full set collapses to `null` ("every channel"), matching
 * the backend's storage convention so an unrestricted row never persists a redundant mask.
 */
export function maskFromOrderTypes(types: readonly OrderType[]): number | null {
  const mask = types.reduce((acc, type) => acc | CHANNEL_BIT[type], 0);
  return mask === ALL_MASK ? null : mask;
}

/** Whether a stored mask permits an order type. A null mask is unrestricted. */
export function maskAllows(mask: number | null | undefined, orderType: OrderType): boolean {
  if (mask === null || mask === undefined) return true;
  return (mask & CHANNEL_BIT[orderType]) !== 0;
}

/** True when the mask permits every order type (stored as null, but tolerate an explicit full mask). */
export function isUnrestricted(mask: number | null | undefined): boolean {
  return mask === null || mask === undefined || mask === ALL_MASK;
}
