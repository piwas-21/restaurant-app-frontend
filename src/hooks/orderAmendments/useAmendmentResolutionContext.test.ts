import { act, renderHook, waitFor } from '@testing-library/react';
import { getAmendmentResolutionContext } from '@/services/amendmentResolutionContextService';
import { prepareAmendmentEarningRetirement } from '@/services/amendmentEarningRetirementService';
import { useAmendmentResolutionContext } from './useAmendmentResolutionContext';

jest.mock('@/services/amendmentResolutionContextService', () => ({ getAmendmentResolutionContext: jest.fn() }));
jest.mock('@/services/amendmentEarningRetirementService', () => ({ prepareAmendmentEarningRetirement: jest.fn() }));
const context = {
  orderId: 'order',
  amendmentId: 'amendment',
  expectedOrderVersion: 7,
  expectedAccountRevision: null,
  currency: 'CHF',
  creditMinor: 333,
  manualRefundCandidates: [],
  earningRetirementRequired: false,
};
describe('fresh financial context recovery', () => {
  beforeEach(() => jest.clearAllMocks());
  it('does not fetch new quote context while new reviews are disabled', () => {
    renderHook(() => useAmendmentResolutionContext({ orderId: 'order', amendmentId: 'amendment', enabled: false }));
    expect(getAmendmentResolutionContext).not.toHaveBeenCalled();
  });
  it('removes the usable stale context when refresh fails and rejects the refusal resume', async () => {
    jest
      .mocked(getAmendmentResolutionContext)
      .mockResolvedValueOnce(context)
      .mockRejectedValueOnce(new Error('private-provider-error'));
    const { result } = renderHook(() =>
      useAmendmentResolutionContext({ orderId: 'order', amendmentId: 'amendment', enabled: true }),
    );
    await waitFor(() => expect(result.current.context).toEqual(context));
    await act(async () => {
      await expect(result.current.refresh()).rejects.toThrow('resolution-context-unavailable');
    });
    expect(result.current.context).toBeUndefined();
    expect(result.current.failed).toBe(true);
    expect(result.current.loading).toBe(false);
  });
  it('can explicitly refresh after a refused operation while automatic preparation is suspended', async () => {
    jest.mocked(getAmendmentResolutionContext).mockResolvedValue(context);
    const { result } = renderHook(() =>
      useAmendmentResolutionContext({ orderId: 'order', amendmentId: 'amendment', enabled: false }),
    );
    await act(async () => result.current.refresh());
    expect(result.current.context).toEqual(context);
    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(1);
  });

  it('prepares retirement from the fresh context and reloads before exposing review', async () => {
    const required = { ...context, earningRetirementRequired: true };
    const onPrepared = jest.fn(() => expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(1));
    jest
      .mocked(getAmendmentResolutionContext)
      .mockResolvedValueOnce(required)
      .mockResolvedValueOnce({ ...context, expectedOrderVersion: 8 });
    jest.mocked(prepareAmendmentEarningRetirement).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAmendmentResolutionContext({ orderId: 'order', amendmentId: 'amendment', enabled: true, onPrepared }),
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));

    await act(async () => result.current.prepareEarningRetirement());

    expect(prepareAmendmentEarningRetirement).toHaveBeenCalledTimes(1);
    expect(prepareAmendmentEarningRetirement).toHaveBeenCalledWith('order', 'amendment', required);
    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(2);
    expect(result.current.context).toMatchObject({ expectedOrderVersion: 8, earningRetirementRequired: false });
    expect(result.current.retirementFailed).toBe(false);
    expect(onPrepared).toHaveBeenCalledTimes(1);
  });

  it('allows only one same-tick retirement request for the current context', async () => {
    const required = { ...context, earningRetirementRequired: true };
    jest
      .mocked(getAmendmentResolutionContext)
      .mockResolvedValueOnce(required)
      .mockResolvedValueOnce({ ...context, expectedOrderVersion: 8 });
    let release!: () => void;
    jest.mocked(prepareAmendmentEarningRetirement).mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useAmendmentResolutionContext({ orderId: 'order', amendmentId: 'amendment', enabled: true }),
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.prepareEarningRetirement();
      second = result.current.prepareEarningRetirement();
      expect(prepareAmendmentEarningRetirement).toHaveBeenCalledTimes(1);
      release();
      await Promise.all([first, second]);
    });

    expect(prepareAmendmentEarningRetirement).toHaveBeenCalledTimes(1);
    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(2);
  });

  it('does not refresh or update the new order context when the old preparation resolves late', async () => {
    const required = { ...context, earningRetirementRequired: true };
    const nextOrder = { ...context, orderId: 'next-order' };
    jest.mocked(getAmendmentResolutionContext).mockResolvedValueOnce(required).mockResolvedValueOnce(nextOrder);
    let release!: () => void;
    jest.mocked(prepareAmendmentEarningRetirement).mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ orderId }: { orderId: string }) =>
        useAmendmentResolutionContext({
          actorId: 'actor',
          orderId,
          amendmentId: 'amendment',
          enabled: true,
        }),
      { initialProps: { orderId: 'order' } },
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));

    let preparation!: Promise<void>;
    act(() => {
      preparation = result.current.prepareEarningRetirement();
    });
    expect(result.current.retiring).toBe(true);

    rerender({ orderId: 'next-order' });
    await waitFor(() => expect(result.current.context?.orderId).toBe('next-order'));
    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(2);

    await act(async () => {
      release();
      await preparation;
    });

    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(2);
    expect(result.current.context).toEqual(nextOrder);
    expect(result.current.retiring).toBe(false);
  });

  it('clears and reloads context when only the actor changes', async () => {
    const nextActorContext = { ...context, expectedOrderVersion: 8 };
    jest.mocked(getAmendmentResolutionContext).mockResolvedValueOnce(context).mockResolvedValueOnce(nextActorContext);
    const { result, rerender } = renderHook(
      ({ currentActorId }: { currentActorId: string }) =>
        useAmendmentResolutionContext({
          actorId: currentActorId,
          orderId: 'order',
          amendmentId: 'amendment',
          enabled: true,
        }),
      { initialProps: { currentActorId: 'first-actor' } },
    );
    await waitFor(() => expect(result.current.context).toEqual(context));

    rerender({ currentActorId: 'second-actor' });
    expect(result.current.context).toBeUndefined();
    await waitFor(() => expect(result.current.context).toEqual(nextActorContext));
    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(2);
  });

  it('ignores a retirement completion after the context becomes disabled', async () => {
    const required = { ...context, earningRetirementRequired: true };
    const onPrepared = jest.fn();
    jest.mocked(getAmendmentResolutionContext).mockResolvedValueOnce(required);
    let release!: () => void;
    jest.mocked(prepareAmendmentEarningRetirement).mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ isEnabled }: { isEnabled: boolean }) =>
        useAmendmentResolutionContext({
          actorId: 'actor',
          orderId: 'order',
          amendmentId: 'amendment',
          enabled: isEnabled,
          onPrepared,
        }),
      { initialProps: { isEnabled: true } },
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));

    let preparation!: Promise<void>;
    act(() => {
      preparation = result.current.prepareEarningRetirement();
    });
    rerender({ isEnabled: false });
    expect(result.current.context).toBeUndefined();
    expect(result.current.retiring).toBe(false);

    await act(async () => {
      release();
      await preparation;
    });

    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(1);
    expect(onPrepared).not.toHaveBeenCalled();
    expect(result.current.context).toBeUndefined();
    expect(result.current.retirementFailed).toBe(false);
  });

  it('releases its pending UI state after disable and re-enable without refreshing the new context', async () => {
    const required = { ...context, earningRetirementRequired: true };
    const onPrepared = jest.fn();
    jest.mocked(getAmendmentResolutionContext).mockResolvedValueOnce(required).mockResolvedValueOnce(required);
    let release!: () => void;
    jest.mocked(prepareAmendmentEarningRetirement).mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ isEnabled }: { isEnabled: boolean }) =>
        useAmendmentResolutionContext({
          actorId: 'actor',
          orderId: 'order',
          amendmentId: 'amendment',
          enabled: isEnabled,
          onPrepared,
        }),
      { initialProps: { isEnabled: true } },
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));

    let preparation!: Promise<void>;
    act(() => {
      preparation = result.current.prepareEarningRetirement();
    });
    rerender({ isEnabled: false });
    rerender({ isEnabled: true });
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));
    expect(result.current.retiring).toBe(true);

    await act(async () => {
      release();
      await preparation;
    });

    expect(getAmendmentResolutionContext).toHaveBeenCalledTimes(2);
    expect(result.current.context).toEqual(required);
    expect(result.current.retiring).toBe(false);
    expect(onPrepared).not.toHaveBeenCalled();
  });

  it('does not clear a newer different-scope retirement while the old request resolves', async () => {
    const oldRequired = { ...context, earningRetirementRequired: true };
    const newRequired = { ...context, orderId: 'next-order', earningRetirementRequired: true };
    const newResolved = { ...newRequired, earningRetirementRequired: false };
    const onPrepared = jest.fn();
    jest
      .mocked(getAmendmentResolutionContext)
      .mockResolvedValueOnce(oldRequired)
      .mockResolvedValueOnce(newRequired)
      .mockResolvedValueOnce(newResolved);
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    jest
      .mocked(prepareAmendmentEarningRetirement)
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseOld = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseNew = resolve;
        }),
      );
    const { result, rerender } = renderHook(
      ({ orderId }: { orderId: string }) =>
        useAmendmentResolutionContext({
          actorId: 'actor',
          orderId,
          amendmentId: 'amendment',
          enabled: true,
          onPrepared,
        }),
      { initialProps: { orderId: 'order' } },
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));
    let oldPreparation!: Promise<void>;
    act(() => {
      oldPreparation = result.current.prepareEarningRetirement();
    });

    rerender({ orderId: 'next-order' });
    await waitFor(() => expect(result.current.context).toEqual(newRequired));
    let newPreparation!: Promise<void>;
    act(() => {
      newPreparation = result.current.prepareEarningRetirement();
    });
    expect(result.current.retiring).toBe(true);

    await act(async () => {
      releaseOld();
      await oldPreparation;
    });
    expect(result.current.context).toEqual(newRequired);
    expect(result.current.retiring).toBe(true);
    expect(onPrepared).not.toHaveBeenCalled();

    await act(async () => {
      releaseNew();
      await newPreparation;
    });
    expect(result.current.context).toEqual(newResolved);
    expect(result.current.retiring).toBe(false);
    expect(onPrepared).toHaveBeenCalledTimes(1);
  });

  it('refreshes after a stale-version refusal without replaying the retirement request', async () => {
    const required = { ...context, earningRetirementRequired: true };
    const current = { ...required, expectedOrderVersion: 8, expectedAccountRevision: 10 };
    const onPrepared = jest.fn();
    jest.mocked(getAmendmentResolutionContext).mockResolvedValueOnce(required).mockResolvedValueOnce(current);
    jest.mocked(prepareAmendmentEarningRetirement).mockRejectedValue(new Error('stale-version'));
    const { result } = renderHook(() =>
      useAmendmentResolutionContext({ orderId: 'order', amendmentId: 'amendment', enabled: true, onPrepared }),
    );
    await waitFor(() => expect(result.current.context?.earningRetirementRequired).toBe(true));

    await act(async () => result.current.prepareEarningRetirement());

    expect(prepareAmendmentEarningRetirement).toHaveBeenCalledTimes(1);
    expect(result.current.context).toEqual(current);
    expect(result.current.retirementFailed).toBe(true);
    expect(onPrepared).not.toHaveBeenCalled();
  });
});
