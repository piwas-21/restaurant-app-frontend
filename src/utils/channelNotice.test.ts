import { OrderType } from '@/types/order';
import { resolveChannelNotice } from './channelNotice';

const ALL = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];
const NOT_DINE_IN = [OrderType.Takeaway, OrderType.Delivery];

describe('resolveChannelNotice', () => {
  it('says nothing about an unrestricted thing', () => {
    expect(resolveChannelNotice({ allowed: ALL, enabled: ALL, orderType: null, canOrder: true })).toBeNull();
  });

  it('carries a neutral info notice for a restricted thing before a channel is chosen', () => {
    expect(resolveChannelNotice({ allowed: NOT_DINE_IN, enabled: ALL, orderType: null, canOrder: true })).toEqual({
      tone: 'info',
      orderable: NOT_DINE_IN,
    });
  });

  it('says nothing once a channel that works is chosen — a chip there is noise', () => {
    expect(
      resolveChannelNotice({ allowed: NOT_DINE_IN, enabled: ALL, orderType: OrderType.Takeaway, canOrder: true }),
    ).toBeNull();
  });

  it('blocks only on the SERVER verdict, never on a channel comparison', () => {
    // Chosen channel is not in `allowed`, but the server said yes — the client must not overrule it.
    expect(
      resolveChannelNotice({ allowed: NOT_DINE_IN, enabled: ALL, orderType: OrderType.DineIn, canOrder: true }),
    ).toBeNull();

    expect(
      resolveChannelNotice({ allowed: NOT_DINE_IN, enabled: ALL, orderType: OrderType.DineIn, canOrder: false }),
    ).toEqual({ tone: 'blocked', orderable: NOT_DINE_IN });
  });

  it('reports only channels the admin has switched on', () => {
    expect(
      resolveChannelNotice({
        allowed: NOT_DINE_IN,
        enabled: [OrderType.DineIn, OrderType.Takeaway],
        orderType: null,
        canOrder: true,
      }),
    ).toEqual({ tone: 'info', orderable: [OrderType.Takeaway] });
  });

  it('stays silent when the restriction is unstateable (every allowed channel is admin-disabled)', () => {
    // "Delivery only" would advertise a channel the guest cannot pick, so nothing is said at all.
    expect(
      resolveChannelNotice({
        allowed: [OrderType.Delivery],
        enabled: [OrderType.DineIn, OrderType.Takeaway],
        orderType: null,
        canOrder: true,
      }),
    ).toBeNull();
  });

  it('still speaks when the server blocks and nothing is orderable — the caller says "Unavailable"', () => {
    expect(
      resolveChannelNotice({
        allowed: [OrderType.Delivery],
        enabled: [OrderType.DineIn, OrderType.Takeaway],
        orderType: OrderType.DineIn,
        canOrder: false,
      }),
    ).toEqual({ tone: 'blocked', orderable: [] });
  });

  it('reports channels in declaration order, not in the order the server listed them', () => {
    const notice = resolveChannelNotice({
      allowed: [OrderType.Delivery, OrderType.DineIn],
      enabled: ALL,
      orderType: null,
      canOrder: true,
    });

    expect(notice?.orderable).toEqual([OrderType.DineIn, OrderType.Delivery]);
  });
});
