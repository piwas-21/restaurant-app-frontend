import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrders } from './useOrders';
import { getOrders } from '@/services/orderService';
import { ApiError } from '@/utils/apiClient';

const mockEnqueue = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }) }));
jest.mock('@/services/orderService', () => ({ getOrders: jest.fn() }));

const mockGetOrders = getOrders as jest.Mock;

const page = (items: unknown[], hasNextPage = false) => ({ items, hasNextPage });
const active = { id: 'a1', status: 'Pending', orderDate: '2026-08-01T10:00:00Z' };
const past = { id: 'p1', status: 'Completed', orderDate: '2026-07-01T10:00:00Z' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockGetOrders.mockResolvedValue(page([active, past]));
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

/**
 * The defect these pin (E9 slice 8). `fetchActive` and `fetchPast` each swallowed their failure
 * behind a comment promising the error would be shown "on first load" — and it never was, because
 * `fetchAll` awaits both, so its own catch could not fire. A guest whose first load failed saw an
 * empty Active tab, an empty Past tab, no message and no toast: indistinguishable from having
 * placed no orders. Deciding whether a failure is worth showing now belongs to each of the three
 * callers, and these are the three answers.
 */
describe('useOrders — who reports a failure', () => {
  it('first load: surfaces the server’s own sentence in `error` AND a toast', async () => {
    mockGetOrders.mockRejectedValue(new ApiError(503, 'Order history is being migrated'));
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await result.current.fetchAll();
    });

    expect(result.current.error).toBe('Order history is being migrated');
    expect(mockEnqueue).toHaveBeenCalledWith(
      'Order history is being migrated',
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('first load: falls back to the translated sentence when the server authored none', async () => {
    mockGetOrders.mockRejectedValue(new Error('socket hang up'));
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await result.current.fetchAll();
    });

    expect(result.current.error).toBe('Failed to load orders');
    // The thrown Error's own text is client-side noise and must not reach the screen.
    expect(result.current.error).not.toContain('socket hang up');
  });

  // `fetchAll` awaits BOTH fetches through one `Promise.all`, so a test that fails both proves
  // only that at least one of them propagates — mutating either swallow on its own leaves it
  // green. These two split them. `fetchActive` asks without a `page`, `fetchPast` with one.
  const failOnly = (which: 'active' | 'past', error: unknown) =>
    mockGetOrders.mockImplementation((filters: { page?: number } = {}) => {
      const isPast = filters.page !== undefined;
      if ((which === 'past') === isPast) return Promise.reject(error);
      return Promise.resolve(page([active, past]));
    });

  it('first load: surfaces a failure of the ACTIVE fetch alone', async () => {
    failOnly('active', new ApiError(500, 'Active orders unavailable'));
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await result.current.fetchAll();
    });

    expect(result.current.error).toBe('Active orders unavailable');
  });

  it('first load: surfaces a failure of the PAST fetch alone', async () => {
    failOnly('past', new ApiError(500, 'Order history unavailable'));
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await result.current.fetchAll();
    });

    expect(result.current.error).toBe('Order history unavailable');
  });

  it('first load: reports nothing when it succeeds', async () => {
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await result.current.fetchAll();
    });

    expect(result.current.error).toBe('');
    expect(result.current.activeOrders).toHaveLength(1);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('background poll: stays silent and keeps the list already on screen', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {
      await result.current.fetchAll();
    });
    expect(result.current.activeOrders).toHaveLength(1);
    mockEnqueue.mockClear();

    // The user did not ask for this fetch. A toast twice a minute for a blip they never noticed
    // is worse than stale — and the poll runs inside a setTimeout, where a rejection has no
    // caller to reach.
    mockGetOrders.mockClear();
    mockGetOrders.mockRejectedValue(new ApiError(500, 'Upstream timeout'));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    // Assert the poll actually RAN — otherwise "stays silent" passes vacuously and would keep
    // passing if the timer were removed entirely.
    expect(mockGetOrders).toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(result.current.error).toBe('');
    expect(result.current.activeOrders).toHaveLength(1);
  });

  it('background poll: takes a stale banner back down once the backend returns', async () => {
    // The regression the `&& !error` empty-state suppression on the page introduced. `error` is
    // cleared only by a full load, and the poll refreshes the Active tab alone — so a failed first
    // load followed by a recovering backend left the banner up with NO empty state and no "Browse
    // Menu" button, permanently, until the customer pressed Refresh.
    mockGetOrders.mockRejectedValue(new ApiError(503, 'Order history is being migrated'));
    const { result } = renderHook(() => useOrders());
    await act(async () => {
      await result.current.fetchAll();
    });
    expect(result.current.error).toBe('Order history is being migrated');
    mockEnqueue.mockClear();

    mockGetOrders.mockResolvedValue(page([active, past]));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.error).toBe('');
    expect(result.current.activeOrders).toHaveLength(1);
    // Both tabs recover together — the quiet retry runs the PAST fetch too, so the banner is not
    // swapped for a wrong "No Past Orders".
    expect(result.current.pastOrders).toHaveLength(1);
    // Quiet: the user did not ask for this one.
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('background poll: the quiet retry restores every page the reader had loaded', async () => {
    // `fetchPast(1, false)` REPLACES the past list, so a naive self-heal collapsed a paginated
    // Past tab back to page 1 thirty seconds after a failed refresh — moving the page under
    // someone who was reading it, for a load they never asked for.
    mockGetOrders.mockImplementation((filters: { page?: number } = {}) =>
      Promise.resolve(page([{ ...past, id: `p${filters.page ?? 1}` }], (filters.page ?? 1) < 3)),
    );
    const { result } = renderHook(() => useOrders());
    await act(async () => {
      await result.current.fetchAll();
    });
    await act(async () => {
      await result.current.loadMorePast();
    });
    expect(result.current.pastOrders.map((o) => o.id)).toEqual(['p1', 'p2']);

    // A refresh fails, then the backend comes back.
    mockGetOrders.mockRejectedValueOnce(new ApiError(503, 'Backend blip'));
    await act(async () => {
      await result.current.fetchAll();
    });
    expect(result.current.error).toBe('Backend blip');

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.error).toBe('');
    expect(result.current.pastOrders.map((o) => o.id)).toEqual(['p1', 'p2']);
  });

  it('background poll: a failed quiet retry keeps the banner and stays silent', async () => {
    mockGetOrders.mockRejectedValue(new ApiError(503, 'still down'));
    const { result } = renderHook(() => useOrders());
    await act(async () => {
      await result.current.fetchAll();
    });
    mockEnqueue.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.error).toBe('still down');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('load more: toasts, keeps the orders already loaded, and does not advance the page', async () => {
    mockGetOrders.mockResolvedValue(page([past], true));
    const { result } = renderHook(() => useOrders());
    await act(async () => {
      await result.current.fetchAll();
    });
    const loadedBefore = result.current.pastOrders.length;
    mockEnqueue.mockClear();

    mockGetOrders.mockRejectedValue(new ApiError(500, 'Page 2 is unavailable'));
    await act(async () => {
      await result.current.loadMorePast();
    });

    expect(mockEnqueue).toHaveBeenCalledWith('Page 2 is unavailable', expect.objectContaining({ variant: 'error' }));
    // Blanking what is already on screen behind `error` would be a regression, so the panel
    // message stays empty and only the toast reports it.
    expect(result.current.error).toBe('');
    expect(result.current.pastOrders).toHaveLength(loadedBefore);

    // `pastPage` was not advanced, so the retry asks for the SAME page rather than skipping it.
    mockGetOrders.mockClear();
    mockGetOrders.mockResolvedValue(page([{ ...past, id: 'p2' }], false));
    await act(async () => {
      await result.current.loadMorePast();
    });
    expect(mockGetOrders).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('load more: does not reject — the button hands it a floating promise', async () => {
    const { result } = renderHook(() => useOrders());
    await act(async () => {
      await result.current.fetchAll();
    });

    mockGetOrders.mockRejectedValue(new ApiError(500, 'nope'));
    await act(async () => {
      await expect(result.current.loadMorePast()).resolves.toBeUndefined();
    });
  });
});

describe('useOrders — waitFor sanity on the loading flag', () => {
  it('clears isLoading even when the first load fails', async () => {
    mockGetOrders.mockRejectedValue(new ApiError(500, 'down'));
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await result.current.fetchAll();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
