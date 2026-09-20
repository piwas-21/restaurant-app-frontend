import { act, renderHook, waitFor } from '@testing-library/react';
import { getGuestOrderStatus } from '@/services/order/orderQueries';
import { ApiError } from '@/utils/apiClient';
import { useGuestOrderWatch } from './useGuestOrderWatch';

jest.mock('@/services/order/orderQueries', () => ({
  getGuestOrderStatus: jest.fn(),
}));

const getStatus = getGuestOrderStatus as jest.MockedFunction<typeof getGuestOrderStatus>;
const pending = {
  orderNumber: 'ORD-42',
  type: 'Takeaway',
  status: 'Pending',
  estimatedDeliveryTime: null,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  getStatus.mockResolvedValue(pending);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useGuestOrderWatch', () => {
  it('loads the guest-safe projection and reports the review phase', async () => {
    const { result } = renderHook(() => useGuestOrderWatch('order-id', 'read-token'));

    await waitFor(() => expect(result.current.phase).toBe('reviewing'));
    expect(getStatus).toHaveBeenCalledWith('order-id', 'read-token');
    expect(result.current.status).toEqual(pending);
  });

  it('polls every 15 seconds while pending and stops after approval', async () => {
    getStatus
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ ...pending, status: 'Confirmed', estimatedDeliveryTime: '2026-09-20T12:30:00Z' });
    const { result } = renderHook(() => useGuestOrderWatch('order-id', 'read-token'));
    await waitFor(() => expect(result.current.phase).toBe('reviewing'));

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.phase).toBe('approved'));

    act(() => {
      jest.advanceTimersByTime(45_000);
    });
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it('pauses endpoint calls while hidden and resumes after the tab becomes visible', async () => {
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { result } = renderHook(() => useGuestOrderWatch('order-id', 'read-token'));
    await waitFor(() => expect(result.current.phase).toBe('reviewing'));

    act(() => jest.advanceTimersByTime(15_000));
    expect(getStatus).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue('visible');
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(getStatus).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });

  it('stops polling when a long preparation time enters the existing customer-approval flow', async () => {
    getStatus.mockResolvedValueOnce({
      ...pending,
      status: 'PendingApproval',
      estimatedDeliveryTime: '2026-09-20T13:00:00Z',
    });
    const { result } = renderHook(() => useGuestOrderWatch('order-id', 'read-token'));
    await waitFor(() => expect(result.current.phase).toBe('delay-approval'));

    act(() => {
      jest.advanceTimersByTime(45_000);
    });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it('does not call the endpoint without both id and token', async () => {
    const { result } = renderHook(() => useGuestOrderWatch('order-id', null));
    expect(result.current.phase).toBe('loading');
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('retries a transient failure instead of turning it into an invalid-token screen', async () => {
    getStatus.mockRejectedValueOnce(new ApiError(503, '')).mockResolvedValueOnce(pending);
    const { result } = renderHook(() => useGuestOrderWatch('order-id', 'read-token'));

    expect(result.current.phase).toBe('loading');
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.phase).toBe('reviewing'));
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it('uses the same unavailable state for an unknown id or wrong token', async () => {
    getStatus.mockRejectedValueOnce(new ApiError(404, ''));
    const { result } = renderHook(() => useGuestOrderWatch('order-id', 'wrong-token'));
    await waitFor(() => expect(result.current.phase).toBe('unavailable'));
    expect(result.current.status).toBeNull();
  });
});
