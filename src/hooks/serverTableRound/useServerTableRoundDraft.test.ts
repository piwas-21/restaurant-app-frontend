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
type HookProps = { sessionId: string | null; matches: boolean; resolved: boolean };

describe('useServerTableRoundDraft', () => {
  beforeEach(() => {
    clearServerTableRoundDraft();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ email: 'server@example.test' }));
  });

  it('does not clear a draft while the authoritative session is still loading', async () => {
    persistServerTableRoundDraft(draft);
    const { result, rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: null, matches: false, resolved: false } as HookProps },
    );

    await act(async () => rerender({ sessionId: 'session-1', matches: true, resolved: true }));

    expect(result.current.items).toEqual(items);
    expect(result.current.notes).toBe('no onions');
    expect(result.current.operationState).toBe('unknown');
  });

  it('clears a draft when an authoritative session closes', async () => {
    persistServerTableRoundDraft(draft);
    const { rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: 'session-1', matches: true, resolved: true } as HookProps },
    );

    await act(async () => rerender({ sessionId: null, matches: false, resolved: true }));

    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
  });

  it('clears a draft when the active session no longer matches the route', async () => {
    persistServerTableRoundDraft(draft);
    const { rerender } = renderHook(
      ({ sessionId, matches, resolved }: HookProps) => useServerTableRoundDraft('T-QA/3', sessionId, matches, resolved),
      { initialProps: { sessionId: 'session-1', matches: true, resolved: true } as HookProps },
    );

    await act(async () => rerender({ sessionId: 'session-2', matches: false, resolved: true }));

    expect(readServerTableRoundDraft('T-QA/3', 'session-1')).toBeNull();
  });
});
