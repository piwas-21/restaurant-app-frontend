import { apiClient } from '@/utils/apiClient';
import { deliverServerTask, getServerTaskFeed } from './serverWorkspaceService';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient') as typeof import('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const feed = {
  serverTime: '2026-09-22T10:00:00Z',
  items: [],
  totalCount: 0,
  nextCursor: 'watermark-1',
  hasMore: false,
  removedOrderIds: [],
};

beforeEach(() => jest.clearAllMocks());

describe('server task service', () => {
  it('serializes the bucket and cursor query without inventing fields', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: feed });

    await expect(getServerTaskFeed({ bucket: 'ready', cursor: 'opaque cursor', pageSize: 50 })).resolves.toEqual(feed);
    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/api/staff/server-workspace/tasks?bucket=ready&cursor=opaque+cursor&pageSize=50',
      { requireAuth: true },
    );
  });

  it('sends the exact expected version body for delivery', async () => {
    mockApiClient.post.mockResolvedValue({ success: true, data: { id: 'order-1' } });

    await expect(deliverServerTask('order/1', { expectedVersion: 4 })).resolves.toEqual({ id: 'order-1' });
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/staff/server-workspace/tasks/order%2F1/deliver',
      { expectedVersion: 4 },
      { requireAuth: true },
    );
  });

  it('does not turn a refusal envelope into a successful task mutation', async () => {
    mockApiClient.post.mockResolvedValue({ success: false, errorCode: 'OrderVersionConflict' });
    await expect(deliverServerTask('order-1', { expectedVersion: 4 })).rejects.toMatchObject({
      errorCode: 'OrderVersionConflict',
    });
  });
});
