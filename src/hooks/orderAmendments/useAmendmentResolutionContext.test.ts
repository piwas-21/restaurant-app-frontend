import { act, renderHook, waitFor } from '@testing-library/react';
import { getAmendmentResolutionContext } from '@/services/amendmentResolutionContextService';
import { useAmendmentResolutionContext } from './useAmendmentResolutionContext';

jest.mock('@/services/amendmentResolutionContextService', () => ({ getAmendmentResolutionContext: jest.fn() }));
const context = {
  orderId: 'order',
  amendmentId: 'amendment',
  expectedOrderVersion: 7,
  expectedAccountRevision: null,
  currency: 'CHF',
  creditMinor: 333,
  manualRefundCandidates: [],
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
});
