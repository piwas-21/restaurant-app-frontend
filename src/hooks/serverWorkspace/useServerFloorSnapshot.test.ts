import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { getServerFloorSnapshot } from '@/services/serverWorkspaceService';
import { useServerFloorSnapshot } from './useServerFloorSnapshot';
import type { ServerFloorSnapshot } from '@/types/serverWorkspace';

jest.mock('@/services/serverWorkspaceService', () => ({ getServerFloorSnapshot: jest.fn() }));

const mockGetSnapshot = getServerFloorSnapshot as jest.MockedFunction<typeof getServerFloorSnapshot>;
const snapshot: ServerFloorSnapshot = {
  serverTime: '2026-09-21T10:00:00Z',
  tenantTime: '2026-09-21T12:00:00+02:00',
  nextStateChangeAt: null,
  version: 'floor-v1',
  cursor: 'floor-v1',
  zones: [],
  tables: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSnapshot.mockResolvedValue(snapshot);
});

describe('useServerFloorSnapshot', () => {
  it('publishes the confirmed snapshot and connected state', async () => {
    const { result } = renderHook(() => useServerFloorSnapshot());

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
    expect(result.current.connectionState).toBe('connected');
    expect(result.current.isStale).toBe(false);
  });

  it('keeps the last snapshot visible and marks it stale after a failed refresh', async () => {
    const { result } = renderHook(() => useServerFloorSnapshot());
    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
    mockGetSnapshot.mockRejectedValueOnce(new ApiError(503, 'Unavailable'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.snapshot).toEqual(snapshot);
    expect(result.current.isStale).toBe(true);
    expect(result.current.connectionState).toBe('stale');
    expect(result.current.error).toBe('Unavailable');
  });

  it('refreshes at the next backend state boundary using tenant-server time', async () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() => useServerFloorSnapshot());

    await act(async () => {
      await result.current.refresh();
    });

    mockGetSnapshot.mockClear();
    mockGetSnapshot.mockResolvedValue({
      ...snapshot,
      tenantTime: '2026-09-21T12:00:00+02:00',
      nextStateChangeAt: '2026-09-21T12:00:10+02:00',
    });

    await act(async () => {
      await result.current.refresh();
    });
    mockGetSnapshot.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(9_999);
    });
    expect(mockGetSnapshot).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockGetSnapshot).toHaveBeenCalledTimes(1);

    unmount();
    jest.useRealTimers();
  });
});
