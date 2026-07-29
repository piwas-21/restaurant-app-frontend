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
import type { BasketDto } from '@/types/basket';
import { getSessionId } from '@/services/sessionService';

interface BasketChannelSwitchApiResponse {
  success: boolean;
  message: string;
  data?: BasketChannelSwitch;
}

interface ClearBasketOrderTypeApiResponse {
  success: boolean;
  message: string;
  /**
   * The full basket after clearing (`ApiResponse<BasketDto?>` server-side), or absent when there was
   * no basket to clear. Typed via the existing `Basket` mirror rather than an inline shape: an
   * ad-hoc `{ orderType }` contradicted `types/basket.ts` on optionality as well as on shape, and
   * because nothing reads the payload TypeScript would never have caught the drift.
   */
  data?: BasketDto | null;
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

/**
 * Tell the server this basket has NO channel — the counterpart to {@link setBasketOrderType}.
 *
 * **This is what DISARMS the server-side guard.** The client drops the guest's channel on several
 * paths — the 24h TTL expiring at hydration, `useOrderTypeEnabledGuard` finding the held channel no
 * longer offered, unpinning a scanned table, and finishing a checkout — but until
 * ORDER-TYPE-AVAILABILITY-PLAN §9.17 there was no way to say so: the PUT above takes a non-nullable
 * order type. The server basket stayed armed on the abandoned channel and judged every later add
 * against it, so a guest holding no channel could still be refused for one.
 *
 * Note the TTL path does NOT go through `clearOrderType` — `loadState` returns the empty state
 * directly — so the provider disarms from its hydration effect instead. Do not "simplify" that back
 * into the callback; the flagship §9.17 case is the one that goes through hydration.
 *
 * A DELETE rather than a null on the PUT because clearing **cannot conflict** — a null channel is
 * unrestricted, so every line already in the basket stays orderable — and so it has no use for the
 * PUT's two-phase `removeConflicts` protocol.
 *
 * Idempotent, and never removes lines. Succeeds with no payload when there is no basket: an absent
 * basket already has no channel, so that is the asked-for outcome rather than an error.
 *
 * @throws Whatever `apiClient` throws. Callers treat this as best-effort — see `clearOrderType`.
 */
export async function clearBasketOrderType(): Promise<void> {
  // No session means no basket, so there is nothing armed to disarm. Returning early rather than
  // calling `ensureSession` on purpose: every PUT caller creates a session because it is about to
  // WRITE a channel worth keeping, whereas minting one just to tell the server about a basket that
  // cannot exist is backwards. It also keeps `basket_channel_clear_failed` meaningful — without
  // this, the sessionless case would emit that event for something that is definitionally a no-op.
  if (!getSessionId()) return;

  await apiClient.delete<ClearBasketOrderTypeApiResponse>('/api/Basket/order-type');
}
