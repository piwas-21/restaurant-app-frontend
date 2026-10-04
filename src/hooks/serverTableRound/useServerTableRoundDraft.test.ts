import { act, renderHook } from '@testing-library/react';
import type { OrderItem } from '@/components/catalog/orderItems';
import {
  clearServerTableRoundDraft,
  persistServerTableRoundDraft,
  readServerTableRoundDraft,
} from '@/lib/serverTableRoundDraft';
import { useServerTableRoundDraft } from './useServerTableRoundDraft';

const items: OrderItem[] = [{ product: { id: 'p1', name: 'Soup' }, quantity: 1, unitPrice: 8 }];
const draft = {
  tableId: 'T-QA/3',
  serviceSessionId: 'session-1',
  items,
  notes: 'no onions',
  clientOperationId: 'operation-1',
};
const customer = {
  customerUserId: 'user-7',
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.test',
  currentPoints: 120,
  pointsToRedeem: 50,
};
type HookProps = { sessionId: string | null; matches: boolean; resolved: boolean };

describe('useServerTableRoundDraft', () => {
  beforeEach(() => {
    clearServerTableRoundDraft();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ email: 'server@example.test' }));
  });

  it('does not clear a draft while the authoritative session is still loading', async () => {
    persistServerTableRoundDraft({ ...draft, customer });
    const { result, rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: null, matches: false, resolved: false } as HookProps },
    );

    await act(async () => rerender({ sessionId: 'session-1', matches: true, resolved: true }));

    expect(result.current.items).toEqual(items);
    expect(result.current.notes).toBe('no onions');
    expect(result.current.customer).toEqual(customer);
    expect(result.current.operationState).toBe('unknown');
  });

  it('blocks draft actions when storage is unknown and recovers after a successful reread', async () => {
    persistServerTableRoundDraft(draft);
    const getItem = Storage.prototype.getItem;
    let shouldFail = true;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (this === window.sessionStorage && shouldFail) {
        shouldFail = false;
        throw new Error('storage denied');
      }
      return getItem.call(this, key);
    });
    const { result } = renderHook(() => useServerTableRoundDraft('T-QA/3', 'session-1', true, true));

    expect(result.current.isReady).toBe(false);
    expect(result.current.storageBlocked).toBe(true);
    expect(result.current.items).toEqual([]);

    jest.restoreAllMocks();
    await act(async () => result.current.retryHydration());

    expect(result.current.isReady).toBe(true);
    expect(result.current.storageBlocked).toBe(false);
    expect(result.current.items).toEqual(items);
    expect(result.current.operationId).toBe('operation-1');
  });

  it('keeps a first product tap when the same session refreshes before draft persistence settles', async () => {
    const { result, rerender } = renderHook(
      ({ resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', 'session-1', true, resolved),
      { initialProps: { sessionId: 'session-1', matches: true, resolved: true } as HookProps },
    );

    expect(result.current.isReady).toBe(true);
    await act(async () => {
      result.current.mutate(() => items);
      rerender({ sessionId: 'session-1', matches: true, resolved: false });
    });

    expect(result.current.items).toEqual(items);
    expect(result.current.isReady).toBe(true);
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')?.items).toEqual(items);

    await act(async () => rerender({ sessionId: 'session-1', matches: true, resolved: true }));
    expect(result.current.items).toEqual(items);
  });

  it('keeps customer identity in recovery and drops the old operation id when it changes', async () => {
    persistServerTableRoundDraft(draft);
    const { result } = renderHook(() => useServerTableRoundDraft('T-QA/3', 'session-1', true, true));
    await act(async () => {
      result.current.setCustomer(customer);
    });

    expect(result.current.customer).toEqual(customer);
    expect(result.current.operationId).toBeUndefined();
    expect(result.current.operationState).toBe('idle');
    expect(readServerTableRoundDraft('T-QA/3', 'session-1')?.customer).toEqual(customer);
  });

  it('expires order contents but retains a pending operation when its session closes', async () => {
    persistServerTableRoundDraft(draft);
    const { rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: 'session-1', matches: true, resolved: true } as HookProps },
    );

    await act(async () => rerender({ sessionId: null, matches: false, resolved: true }));

    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toMatchObject({
      tableId: 'T-QA/3',
      serviceSessionId: 'session-1',
      items: [],
      notes: '',
      clientOperationId: 'operation-1',
    });
  });

  it('preserves a draft when the route no longer matches the still-active session', async () => {
    persistServerTableRoundDraft(draft);
    const { rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: 'session-1', matches: true, resolved: true } as HookProps },
    );

    await act(async () => rerender({ sessionId: 'session-2', matches: false, resolved: true }));

    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toMatchObject(draft);
  });

  it('masks the previous scope in the first render before the new scope hydrates', async () => {
    persistServerTableRoundDraft({ ...draft, customer });
    const snapshots: Array<ReturnType<typeof useServerTableRoundDraft>> = [];
    const { rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => {
        const current = useServerTableRoundDraft('T-QA/3', sessionId, true, true);
        snapshots.push(current);
        return current;
      },
      { initialProps: { sessionId: 'session-1' } },
    );

    expect(snapshots.at(-1)?.isReady).toBe(true);
    expect(snapshots.at(-1)?.operationState).toBe('unknown');
    snapshots.length = 0;
    await act(async () => rerender({ sessionId: 'session-2' }));

    const firstNewScopeRender = snapshots[0];
    expect(firstNewScopeRender.isReady).toBe(false);
    expect(firstNewScopeRender.items).toEqual([]);
    expect(firstNewScopeRender.customer).toBeUndefined();
    expect(firstNewScopeRender.operationId).toBeUndefined();
    expect(firstNewScopeRender.operationState).toBe('idle');
    expect(firstNewScopeRender.createdOrder).toBeNull();
    expect(firstNewScopeRender.operationOwnerScopeKey).toBeNull();
  });

  it('masks a prior committed order before the next scope effect runs', async () => {
    const order = { id: 'order-1', orderNumber: 'R-1' } as never;
    const snapshots: Array<ReturnType<typeof useServerTableRoundDraft>> = [];
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => {
        const current = useServerTableRoundDraft('T-QA/3', sessionId, true, true);
        snapshots.push(current);
        return current;
      },
      { initialProps: { sessionId: 'session-1' } },
    );
    await act(async () => result.current.markCommitted(order));
    expect(result.current.createdOrder).toEqual(order);
    snapshots.length = 0;
    await act(async () => rerender({ sessionId: 'session-2' }));

    expect(snapshots[0].createdOrder).toBeNull();
    expect(snapshots[0].operationState).toBe('idle');
    expect(snapshots[0].items).toEqual([]);
  });

  it('clears committed and unknown operation notices when the scope closes', async () => {
    const order = { id: 'order-1', orderNumber: 'R-1' } as never;
    const { result, rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: 'session-1', matches: true, resolved: true } as HookProps },
    );

    await act(async () => result.current.markCommitted(order));
    expect(result.current.createdOrder).toEqual(order);
    expect(result.current.operationState).toBe('committed');
    await act(async () => {
      result.current.setOperationState('unknown');
      rerender({ sessionId: null, matches: false, resolved: true });
    });

    expect(result.current.createdOrder).toBeNull();
    expect(result.current.operationState).toBe('idle');
    expect(result.current.operationId).toBeUndefined();
  });
});
