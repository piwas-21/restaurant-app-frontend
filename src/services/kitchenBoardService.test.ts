import { apiClient, ApiError } from '@/utils/apiClient';
import { completeKitchenBoardWork, getKitchenBoardWork, WORK_ENDPOINT } from './kitchenBoardService';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const page = {
  items: [],
  totalCount: 0,
  hasMore: false,
  removedIds: [],
  nextCursor: 'watermark',
  watermark: 1,
  mode: 'Watermark',
};
const feed = { orders: page, corrections: page, completions: page };

const completion = {
  orderId: 'order-a',
  workItemId: 'order-a',
  kind: 'InitialOrder' as const,
  accountRevision: null,
  acknowledgedOrderVersion: 4,
  sequence: 1,
  completedAt: '2026-10-08T12:00:00Z',
  isCompleted: true as const,
};

beforeEach(() => jest.clearAllMocks());

describe('kitchenBoardService', () => {
  it('keeps every independent stream cursor on authenticated reads', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: feed });

    await expect(
      getKitchenBoardWork({ orders: 'o-2', corrections: 'c-3', completions: 'x-4', pageSize: 20 }),
    ).resolves.toEqual(feed);
    expect(mockApiClient.get).toHaveBeenCalledWith(
      `${WORK_ENDPOINT}?pageSize=20&ordersCursor=o-2&correctionsCursor=c-3&completionsCursor=x-4`,
      { requireAuth: true },
    );
  });

  it('rejects an invalid feed instead of presenting a partial work queue', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: { ...feed, corrections: { ...page, mode: 'Unknown' as 'Watermark' } },
    });
    await expect(getKitchenBoardWork()).rejects.toBeInstanceOf(ApiError);
  });

  it('accepts an idempotent replay acknowledged at an earlier order version', async () => {
    mockApiClient.post.mockResolvedValue({ success: true, data: completion });

    await expect(
      completeKitchenBoardWork('order-a', 'order-a', {
        kind: 'InitialOrder',
        expectedOrderVersion: 5,
        expectedAccountRevision: null,
      }),
    ).resolves.toEqual(completion);
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/staff/kitchen-board/orders/order-a/work-items/order-a/complete',
      { kind: 'InitialOrder', expectedOrderVersion: 5, expectedAccountRevision: null },
      { requireAuth: true },
    );
  });

  it('rejects a completion response newer than the submitted source version', async () => {
    mockApiClient.post.mockResolvedValue({ success: true, data: { ...completion, acknowledgedOrderVersion: 6 } });
    await expect(
      completeKitchenBoardWork('order-a', 'order-a', {
        kind: 'InitialOrder',
        expectedOrderVersion: 5,
        expectedAccountRevision: null,
      }),
    ).rejects.toMatchObject({ errorCode: 'KitchenBoardCompletionMismatch' });
  });
});
