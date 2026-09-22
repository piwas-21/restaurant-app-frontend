import { initialServerTaskFeedState, reconcileServerTaskFeed, serverTaskReducer } from './serverTaskReducer';
import type { ServerServiceTask, ServerTaskFeed } from '@/types/serverTasks';

const task = (
  orderId: string,
  actionableAt: string,
  overrides: Partial<ServerServiceTask> = {},
): ServerServiceTask => ({
  orderId,
  orderNumber: orderId,
  orderType: 'DineIn',
  status: 'Ready',
  bucket: 'Ready',
  actionableAt,
  ageSeconds: 60,
  tableId: null,
  tableLabel: null,
  tableNumber: null,
  serviceSessionId: null,
  total: 10,
  remainingAmount: 10,
  version: 1,
  routingState: 'Complete',
  hasRequiredRoutingException: false,
  hasOptionalRoutingException: false,
  routing: [],
  permittedDeliveryActions: [{ action: 'HandOver', allowed: true, reasonCode: null, targetStatus: 'Completed' }],
  ...overrides,
});

const feed = (items: ServerServiceTask[], overrides: Partial<ServerTaskFeed> = {}): ServerTaskFeed => ({
  serverTime: '2026-09-22T10:00:00Z',
  items,
  totalCount: items.length,
  nextCursor: 'watermark-1',
  hasMore: false,
  removedOrderIds: [],
  ...overrides,
});

describe('serverTaskReducer', () => {
  it('replaces a snapshot, sorts by actionable time, and keeps the authoritative total', () => {
    const next = serverTaskReducer(initialServerTaskFeedState, {
      type: 'pageReceived',
      feed: feed([task('late', '2026-09-22T11:00:00Z'), task('early', '2026-09-22T09:00:00Z')], { totalCount: 8 }),
      replace: true,
    });
    expect(next.items.map((item) => item.orderId)).toEqual(['early', 'late']);
    expect(next.totalCount).toBe(8);
    expect(next.nextCursor).toBe('watermark-1');
  });

  it('upserts duplicate change rows and removes rows that left the bucket', () => {
    const previous = [task('same', '2026-09-22T10:00:00Z'), task('gone', '2026-09-22T10:01:00Z')];
    const next = reconcileServerTaskFeed(
      previous,
      feed([task('same', '2026-09-22T08:00:00Z', { version: 2 })], { removedOrderIds: ['gone'] }),
    );
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ orderId: 'same', version: 2 });
  });

  it('preserves visible rows while a change request fails', () => {
    const loaded = serverTaskReducer(initialServerTaskFeedState, {
      type: 'pageReceived',
      feed: feed([task('one', '2026-09-22T10:00:00Z')]),
      replace: true,
    });
    const failed = serverTaskReducer(loaded, { type: 'requestFailed', error: 'server.tasks.load_failed', stale: true });
    expect(failed.items).toHaveLength(1);
    expect(failed.isStale).toBe(true);
  });
});
