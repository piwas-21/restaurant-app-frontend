import { renderHook } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useTrackItemBlocked, __resetTrackedBlocks } from './useTrackItemBlocked';
import type { AvailabilityNotice } from './useItemAvailabilityNotice';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const mockOrderType = useOrderType as jest.Mock;
const mockTrack = trackEvent as jest.Mock;

const notice = (tone: 'info' | 'blocked'): AvailabilityNotice => ({
  tone,
  message: 'Takeaway and Delivery only',
  switchTo: null,
  switchLabel: '',
  shortMessage: '',
  hint: null,
});

function setup(orderType: OrderType | null) {
  mockOrderType.mockReturnValue({ state: { orderType } });
}

beforeEach(() => {
  mockTrack.mockReset();
  __resetTrackedBlocks();
  setup(OrderType.DineIn);
});

describe('useTrackItemBlocked', () => {
  it('fires once for a blocked card, with the item and the refused channel', () => {
    renderHook(() => useTrackItemBlocked('p1', notice('blocked')));

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('item_blocked_by_order_type', {
      productId: 'p1',
      orderType: OrderType.DineIn,
      source: 'menu_card',
    });
  });

  it('does not re-fire on re-render — an impression is not a scroll counter', () => {
    const { rerender } = renderHook(() => useTrackItemBlocked('p1', notice('blocked')));
    rerender();
    rerender();

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('fires again when the guest switches channel and is blocked a second time', () => {
    const { rerender } = renderHook(() => useTrackItemBlocked('p1', notice('blocked')));
    setup(OrderType.Delivery);
    rerender();

    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenLastCalledWith(
      'item_blocked_by_order_type',
      expect.objectContaining({ orderType: OrderType.Delivery }),
    );
  });

  it('never fires for the info tone — nothing is blocked before a channel is chosen', () => {
    setup(null);
    renderHook(() => useTrackItemBlocked('p1', notice('info')));

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('never fires without a notice', () => {
    renderHook(() => useTrackItemBlocked('p1', null));

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('never fires without an item id', () => {
    renderHook(() => useTrackItemBlocked(undefined, notice('blocked')));

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('does not re-fire when the SAME refusal is re-resolved (notice drops out and comes back)', () => {
    // The availability notice is null while the enabled-channel list is in flight, so a card can go
    // blocked → nothing → blocked without the guest doing anything. That is one refusal, not two.
    const { rerender } = renderHook(({ n }) => useTrackItemBlocked('p1', n), {
      initialProps: { n: notice('blocked') as AvailabilityNotice | null },
    });
    rerender({ n: null });
    rerender({ n: notice('blocked') });

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire after the card unmounts and comes back — the grid remounts on every page turn', () => {
    // THE case a per-component guard gets wrong: `MenuContent` drops the whole grid while the next
    // page loads, so paging away and back would otherwise report the same refusal again and the
    // event would count renders of blocked cards instead of guests blocked.
    const first = renderHook(() => useTrackItemBlocked('p1', notice('blocked')));
    first.unmount();
    renderHook(() => useTrackItemBlocked('p1', notice('blocked')));

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('still reports a DIFFERENT item after a remount', () => {
    const first = renderHook(() => useTrackItemBlocked('p1', notice('blocked')));
    first.unmount();
    renderHook(() => useTrackItemBlocked('p2', notice('blocked')));

    expect(mockTrack).toHaveBeenCalledTimes(2);
  });

  it('reports the SAME product blocked on two surfaces twice — the hero must not swallow the card', () => {
    // The banner renders above the grid, so with a source-less key it claimed the entry first and
    // the card's event was silently dropped for the rest of the visit: an undercount of the one
    // number this feature exists to measure.
    renderHook(() => useTrackItemBlocked('p1', notice('blocked'), 'featured_special'));
    renderHook(() => useTrackItemBlocked('p1', notice('blocked'), 'menu_card'));

    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenNthCalledWith(
      1,
      'item_blocked_by_order_type',
      expect.objectContaining({ source: 'featured_special' }),
    );
    expect(mockTrack).toHaveBeenNthCalledWith(
      2,
      'item_blocked_by_order_type',
      expect.objectContaining({ source: 'menu_card' }),
    );
  });
});
