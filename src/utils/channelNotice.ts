import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES } from './orderChannels';

/**
 * The channel-restriction decision shared by every customer surface that has to say "this is only
 * orderable on some channels" — the catalog card, the customization sheet, and the category nav.
 *
 * Extracted so the three cannot drift: the *rules* below are subtle enough that a second
 * hand-rolled copy would get one of them wrong, and the wrong ones fail silently (a chip that
 * advertises a channel the guest cannot pick, or a category that dims for a reason the server
 * never gave). Callers keep their own copy-building — a card offers a switch and a hint, a nav tab
 * offers neither — but they all decide *whether and how* to speak here.
 */
export interface ChannelNotice {
  /**
   * `info` — no channel chosen yet (the dominant browse state), so the surface only mentions where
   * the thing can be ordered. Nothing dims, nothing is offered.
   * `blocked` — the chosen channel cannot order it.
   */
  tone: 'info' | 'blocked';
  /**
   * The channels that can actually order it *right now*: its own allowed list, intersected with the
   * channels the admin has switched on. Never empty when a notice is returned — an empty
   * intersection is a restriction that cannot be stated (see below).
   */
  orderable: OrderType[];
}

export interface ChannelNoticeInput {
  /**
   * The server-DECODED list of channels the thing permits (`availability.allowedOrderTypes` on a
   * product, `allowedOrderTypes` on a category). Never a raw `OrderChannels` mask — the bits are
   * 1/2/4 while `OrderType` is 1/2/3 and a stray cast between them fails silently.
   */
  allowed: OrderType[];
  /** Channels the admin has switched on. */
  enabled: OrderType[];
  /** The channel the guest has chosen, or `null` when they have not chosen one. */
  orderType: OrderType | null;
  /**
   * The server's verdict for the CHOSEN channel. A product has one (`availability.canOrder`); a
   * category has no server verdict, so its caller derives it from membership.
   */
  canOrder: boolean;
}

/**
 * Resolve whether there is anything to say, or `null` when there is not.
 *
 * Three rules are load-bearing and each was a bug before it was a rule:
 *
 * 1. **Only the server's verdict blocks.** An item whose every channel the admin switched off is
 *    NOT blocked on its own — the server said `canOrder`, the basket would accept the add (a null
 *    basket channel is permissive), so dimming it is the client overruling the server.
 * 2. **Admin-disabled channels do not exist.** "Delivery only" advertises a channel the guest
 *    cannot pick; if the intersection is empty the restriction is unstateable and we say nothing
 *    rather than invent copy.
 * 3. **Nothing is said once a channel is chosen and it works.** Before a channel is chosen a
 *    restricted thing carries a neutral chip; after, a chip on something orderable is noise.
 */
export function resolveChannelNotice({
  allowed,
  enabled,
  orderType,
  canOrder,
}: ChannelNoticeInput): ChannelNotice | null {
  const orderable = ALL_ORDER_TYPES.filter((type) => enabled.includes(type) && allowed.includes(type));

  const blocked = !canOrder;
  const restricted = orderable.length > 0 && orderable.length < enabled.length;

  // An empty `orderable` makes `restricted` false, so an unstateable restriction exits here too —
  // the only way past this line with nothing orderable is a genuine server block, which still has
  // something to say ("Unavailable").
  if (!blocked && (orderType !== null || !restricted)) return null;

  return { tone: blocked ? 'blocked' : 'info', orderable };
}
