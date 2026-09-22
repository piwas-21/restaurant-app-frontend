import { apiClient } from '@/utils/apiClient';
import { getServerFloorSnapshot, FLOOR_ENDPOINT } from './serverWorkspaceService';
import type { ServerFloorSnapshot } from '@/types/serverWorkspace';

jest.mock('@/utils/apiClient');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const snapshot = {
  serverTime: '2026-09-21T10:00:00Z',
  tenantTime: '2026-09-21T12:00:00+02:00',
  nextStateChangeAt: null,
  version: 'floor-v1',
  cursor: 'floor-v1',
  zones: [],
  tables: [],
} satisfies ServerFloorSnapshot;

beforeEach(() => jest.clearAllMocks());

describe('serverWorkspaceService', () => {
  it('reads the authenticated authoritative floor endpoint', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: snapshot });

    await expect(getServerFloorSnapshot()).resolves.toEqual(snapshot);
    expect(mockApiClient.get).toHaveBeenCalledWith(FLOOR_ENDPOINT, { requireAuth: true });
  });

  it('rejects a refusal envelope instead of treating it as an empty floor', async () => {
    mockApiClient.get.mockReset();
    mockApiClient.get.mockResolvedValue({ success: false, message: 'Floor read refused.' });

    await expect(getServerFloorSnapshot()).rejects.not.toBeUndefined();
  });
});
