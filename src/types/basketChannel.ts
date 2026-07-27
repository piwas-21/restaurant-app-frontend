/**
 * The basket's order-type (channel) contract.
 *
 * Mirrors the backend's `Features/Basket/Dtos/BasketChannelSwitchDto.cs`. Kept out of
 * `types/basket.ts` on purpose: that file is already over the §4 type-file limit and baselined, and
 * this is a self-contained two-phase protocol rather than another basket shape.
 */
import type { OrderType } from '@/types/order';
import type { BasketDto } from '@/types/basket';

/** One basket line the requested order type does not permit. */
export interface BasketChannelConflict {
  basketItemId: string;
  productId?: string;
  /**
   * Always been correct: the server names these from `FindConflictsAsync`'s own product query, not
   * from the basket graph. Plan §9.11 originally claimed otherwise and was corrected — the field
   * that came back nameless is `BasketChannelSwitch.basket`, which this client does not read.
   */
  productName: string;
  quantity: number;
  /** Channels this line IS available on — drives "…is takeaway and delivery only". */
  allowedOrderTypes: OrderType[];
}

/**
 * Result of setting the basket's order type.
 *
 * Two-phase by design: the first call reports conflicts and changes NOTHING, so the guest can be
 * shown an itemized confirm before anything is destroyed; the caller then repeats with
 * `removeConflicts: true`. A basket with no conflicting line applies on the first call.
 */
export interface BasketChannelSwitch {
  /** False when conflicts blocked the switch — nothing changed server-side. */
  applied: boolean;
  /** Lines the requested order type forbids. Empty when the switch applied cleanly. */
  conflicts: BasketChannelConflict[];
  /** Lines actually removed. Only non-empty when the caller opted into removal. */
  removed: BasketChannelConflict[];
  /**
   * The basket after the switch, or as-is when it was blocked.
   *
   * **Deliberately not consumed.** The client re-reads through `syncBasket()` instead, so the cart
   * badge, totals and tax move from one source. That choice is also why backend #236 — which fixed
   * this very field coming back with empty product names on the blocked branch — was not a
   * prerequisite for the conflict modal. Declared so the contract stays honest about what the
   * endpoint returns.
   */
  basket: BasketDto | null;
}
