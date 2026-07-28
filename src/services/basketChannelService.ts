/**
 * Basket order-type (channel) service.
 *
 * Separate from `basketService.ts`, which sits at 180 of its 200-LOC budget — and separate in
 * concept too: every other basket call mutates lines, this one mutates the basket's CHANNEL and can
 * refuse.
 */
import { apiClient } from '@/utils/apiClient';
import type { OrderType } from '@/types/order';
import type { BasketChannelSwitch } from '@/types/basketChannel';

interface BasketChannelSwitchApiResponse {
  success: boolean;
  message: string;
  data?: BasketChannelSwitch;
}

/**
 * Tell the server which channel this basket is being ordered through.
 *
 * **This is what arms the server-side guard.** `Basket.OrderType` starts null and null is
 * permissive by design (a guest browses before choosing), so until this is called
 * `BasketChannelGuard` permits every add — the client's dimmed cards are the only thing enforcing
 * anything. Nothing called this endpoint before ORDER-TYPE-AVAILABILITY-PLAN §4.4 shipped.
 *
 * @param orderType       Channel to switch to.
 * @param removeConflicts Omit or pass false to get a dry run — conflicts come back and NOTHING is
 *                        changed. Repeat with true once the guest has confirmed. The conservative
 *                        value is the default on both sides of the wire, so a caller that forgets
 *                        gets a dry run rather than a silent deletion.
 * @throws Whatever `apiClient` throws. **No longer 404s on an empty cart** — since §9.13 the endpoint
 *         upserts, creating the basket already carrying the channel, so a throw here is a real
 *         failure rather than the expected shape it used to be.
 */
export async function setBasketOrderType(orderType: OrderType, removeConflicts = false): Promise<BasketChannelSwitch> {
  const response = await apiClient.put<BasketChannelSwitchApiResponse>('/api/Basket/order-type', {
    orderType,
    removeConflicts,
  });

  if (!response.data) {
    throw new Error('Order-type switch returned no payload');
  }

  return response.data;
}
