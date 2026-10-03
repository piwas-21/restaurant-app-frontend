import { act, renderHook, waitFor } from '@testing-library/react';
import { listAmendmentResolutionRecovery } from '@/services/amendmentResolutionRecoveryService';
import { pendingResolutionFixture, resolutionResultFixture } from '@/lib/__fixtures__/amendmentResolution';
import { useAmendmentResolutionRecoveryInventory } from './useAmendmentResolutionRecoveryInventory';

jest.mock('@/services/amendmentResolutionRecoveryService', () => ({ listAmendmentResolutionRecovery: jest.fn() }));
const list = jest.mocked(listAmendmentResolutionRecovery);
const original = { pending: pendingResolutionFixture(), result: resolutionResultFixture() };
describe('owner recovery discovery lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());
  it('blocks during lookup and distinguishes affirmative empty from failed inventory', async () => {
    list
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('private-api-detail'))
      .mockResolvedValueOnce([original]);
    const { result } = renderHook(() => useAmendmentResolutionRecoveryInventory('actor', 'order'));
    expect(result.current.inventory.status).toBe('checking');
    await waitFor(() => expect(result.current.inventory.status).toBe('none'));
    await act(async () => result.current.refresh());
    expect(result.current.inventory).toEqual({ status: 'unavailable' });
    await act(async () => result.current.refresh());
    expect(result.current.inventory).toEqual({ status: 'pending', values: [original] });
  });
  it('rejects an older response after a newer recovery read finishes', async () => {
    let resolveFirst: ((value: readonly (typeof original)[]) => void) | undefined;
    list
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useAmendmentResolutionRecoveryInventory('actor', 'order'));
    await act(async () => result.current.refresh());
    expect(result.current.inventory.status).toBe('none');
    await act(async () => resolveFirst?.([original]));
    expect(result.current.inventory.status).toBe('none');
  });
  it('does not apply the previous actor response after identity changes', async () => {
    let resolveOld: ((value: readonly (typeof original)[]) => void) | undefined;
    list
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(({ actor }) => useAmendmentResolutionRecoveryInventory(actor, 'order'), {
      initialProps: { actor: 'old' },
    });
    rerender({ actor: 'new' });
    await waitFor(() => expect(result.current.inventory.status).toBe('none'));
    await act(async () => resolveOld?.([original]));
    expect(result.current.inventory.status).toBe('none');
    expect(list).toHaveBeenLastCalledWith('new', 'order');
  });
});
