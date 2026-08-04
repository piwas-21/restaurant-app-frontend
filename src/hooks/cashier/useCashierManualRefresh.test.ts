import { act, renderHook } from '@testing-library/react';
import { useCashierManualRefresh } from './useCashierManualRefresh';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const reporter = { showSuccess: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('useCashierManualRefresh', () => {
  it('announces success only when the refresh actually landed', async () => {
    const { result } = renderHook(() => useCashierManualRefresh(async () => true, reporter));

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(reporter.showSuccess).toHaveBeenCalledWith('cashier.orders_refreshed');
  });

  it('says NOTHING when the refresh failed — the defect this hook exists for', async () => {
    // `refreshOrders` resolves on both paths, so the page used to report success unconditionally
    // and put that toast on top of the error banner every time the backend was down. And the
    // silence is the point of the second half: `refreshOrders` has already written the server's
    // own sentence into `error`, so a generic alert here would stack a claim beside a reason.
    const { result } = renderHook(() => useCashierManualRefresh(async () => false, reporter));

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(reporter.showSuccess).not.toHaveBeenCalled();
  });

  it('clears the pending flag even if the refresh rejects', async () => {
    // It cannot today, but that guarantee lives in another file; a rejection must not leave the
    // header's Refresh button disabled for the rest of the shift.
    const { result } = renderHook(() =>
      useCashierManualRefresh(async () => {
        throw new Error('unexpected');
      }, reporter),
    );

    await act(async () => {
      await expect(result.current.handleRefresh()).rejects.toThrow('unexpected');
    });

    expect(result.current.isRefreshing).toBe(false);
  });

  it('raises the pending flag while in flight', async () => {
    let release: (value: boolean) => void = () => {};
    const { result } = renderHook(() =>
      useCashierManualRefresh(() => new Promise<boolean>((resolve) => (release = resolve)), reporter),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleRefresh();
    });
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      release(true);
      await pending;
    });
    expect(result.current.isRefreshing).toBe(false);
  });
});
