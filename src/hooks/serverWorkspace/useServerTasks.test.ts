import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { getServerTaskFeed } from '@/services/serverWorkspaceService';
import type { ServerTaskFeed } from '@/types/serverTasks';
import { useServerTasks } from './useServerTasks';

jest.mock('@/services/serverWorkspaceService', () => ({
  getServerTaskFeed: jest.fn(),
  deliverServerTask: jest.fn(),
}));

const mockGetFeed = getServerTaskFeed as jest.MockedFunction<typeof getServerTaskFeed>;

const item = (id: string) => ({
  orderId: id,
  orderNumber: id,
  orderType: 'Takeaway',
  status: 'Ready',
  bucket: 'Ready' as const,
  actionableAt: '2026-09-22T10:00:00Z',
  ageSeconds: 30,
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
});

const feed = (items: ReturnType<typeof item>[], overrides: Partial<ServerTaskFeed> = {}): ServerTaskFeed => ({
  serverTime: '2026-09-22T10:00:00Z',
  items,
  totalCount: items.length,
  nextCursor: null,
  hasMore: false,
  removedOrderIds: [],
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('useServerTasks', () => {
  it('keeps a watermark cursor when hasMore is false and polls it for changes', async () => {
    jest.useFakeTimers();
    mockGetFeed
      .mockResolvedValueOnce(feed([item('one')], { nextCursor: 'watermark-1' }))
      .mockResolvedValueOnce(feed([item('two')], { nextCursor: 'watermark-2', removedOrderIds: ['one'] }));
    const { result, unmount } = renderHook(() => useServerTasks('ready'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.nextCursor).toBe('watermark-1');
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(mockGetFeed).toHaveBeenLastCalledWith({ bucket: 'ready', cursor: 'watermark-1', pageSize: 50 });
    expect(result.current.items.map((task) => task.orderId)).toEqual(['two']);
    unmount();
    jest.useRealTimers();
  });

  it.each(['InvalidOperationalQueueCursor', 'ExpiredOperationalQueueCursor'])(
    'preserves visible rows while %s is replaced by a fresh snapshot',
    async (errorCode) => {
      let resolveFresh: ((value: ServerTaskFeed) => void) | undefined;
      mockGetFeed.mockResolvedValueOnce(feed([item('old')], { nextCursor: 'cursor-1', hasMore: true }));
      const { result, unmount } = renderHook(() => useServerTasks('ready'));
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      mockGetFeed.mockRejectedValueOnce(new ApiError(400, '', [], errorCode));
      mockGetFeed.mockImplementationOnce(
        () =>
          new Promise<ServerTaskFeed>((resolve) => {
            resolveFresh = resolve;
          }),
      );
      await act(async () => {
        const pending = result.current.loadMore();
        await Promise.resolve();
        expect(result.current.items.map((task) => task.orderId)).toEqual(['old']);
        resolveFresh?.(feed([item('new')], { nextCursor: 'watermark-2' }));
        await pending;
      });

      expect(result.current.items.map((task) => task.orderId)).toEqual(['new']);
      expect(mockGetFeed).toHaveBeenLastCalledWith({ bucket: 'ready', cursor: null, pageSize: 50 });
      unmount();
    },
  );
});
