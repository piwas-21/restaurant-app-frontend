import { act, renderHook } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import { serverTableRoundScopeKey, useServerTableRoundScopeState } from './useServerTableRoundScopeState';
import { persistServerTableRoundDraft } from '@/lib/serverTableRoundDraft';
import { getProductById } from '@/services/menuService';
import { reconcileServerTableRound, reviewServerTableRound } from './serverTableRoundReview';
import { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { useServerTableRoundCatalog } from './useServerTableRoundCatalog';
import { useServerTableRound } from './useServerTableRound';

jest.mock('@/lib/serverTableRoundDraft', () => ({
  ...jest.requireActual('@/lib/serverTableRoundDraft'),
  persistServerTableRoundDraft: jest.fn(),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: jest.fn() }));
jest.mock('./serverTableRoundReview', () => ({
  reconcileServerTableRound: jest.fn(),
  reviewServerTableRound: jest.fn(),
}));
jest.mock('./useServerTableRoundDraft', () => ({ useServerTableRoundDraft: jest.fn() }));
jest.mock('./useServerTableRoundCatalog', () => ({ useServerTableRoundCatalog: jest.fn() }));

const mockDraftHook = useServerTableRoundDraft as jest.Mock;
const mockCatalogHook = useServerTableRoundCatalog as jest.Mock;
const mockReview = reviewServerTableRound as jest.MockedFunction<typeof reviewServerTableRound>;
const mockReconcile = reconcileServerTableRound as jest.MockedFunction<typeof reconcileServerTableRound>;
const mockGetProduct = getProductById as jest.MockedFunction<typeof getProductById>;
const mockAuth = jest.requireMock('@/components/AuthContext').useOptionalAuth as jest.Mock;
const markCommitted = jest.fn();
const setOperationId = jest.fn();
const setOperationState = jest.fn();
const setQuote = jest.fn();
const setDraftRecovered = jest.fn();

const state = (overrides: Partial<ServerTableSessionState> = {}): ServerTableSessionState => ({
  table: null,
  session: { serviceSessionId: 'session-1' } as ServerTableSessionState['session'],
  isLoading: false,
  isStarting: false,
  isRepairingLegacyOrders: false,
  repairSuccess: false,
  isStale: false,
  error: null,
  blocker: 'none',
  floorConnectionState: 'connected',
  floorLastConfirmed: null,
  refresh: jest.fn(async () => undefined),
  startTable: jest.fn(),
  repairLegacyOrders: jest.fn(),
  canStartTable: false,
  canAddRound: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.mocked(persistServerTableRoundDraft).mockReturnValue(true);
  mockAuth.mockReturnValue(null);
  mockCatalogHook.mockReturnValue({
    categories: [],
    products: [],
    selectedCategoryId: null,
    setSelectedCategoryId: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    isLoading: false,
    error: null,
    retry: jest.fn(),
    favoriteIds: [],
    showFavorites: false,
    setShowFavorites: jest.fn(),
    toggleFavorite: jest.fn(),
  });
  mockDraftHook.mockReturnValue({
    scopeKey: serverTableRoundScopeKey('T-QA/3', 'session-1', true, undefined),
    items: [{ product: { id: 'p1', name: 'Tea' }, quantity: 1, unitPrice: 8 }],
    notes: '',
    operationId: undefined,
    quote: null,
    createdOrder: null,
    operationState: 'idle',
    draftRecovered: false,
    isReady: true,
    operationOwnerScopeKey: null,
    mutate: jest.fn(),
    setItems: jest.fn(),
    setOperationId,
    setQuote,
    setOperationState,
    setDraftRecovered,
    markCommitted,
    setNotes: jest.fn(),
    discardDraft: jest.fn(),
    setCustomer: jest.fn(),
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function draftMock(tableId: string, sessionId: string, staffEmail: string, overrides: Record<string, unknown> = {}) {
  const scopeKey = serverTableRoundScopeKey(tableId, sessionId, true, staffEmail);
  const result = {
    scopeKey,
    items: [{ product: { id: 'p1', name: 'Tea' }, quantity: 1, unitPrice: 8 }],
    notes: '',
    customer: undefined,
    loyaltyEnabled: false,
    operationId: undefined,
    quote: null,
    createdOrder: null,
    operationState: 'idle',
    draftRecovered: false,
    isReady: true,
    mutate: jest.fn(),
    setItems: jest.fn(),
    setOperationId: jest.fn(),
    setQuote: jest.fn(),
    setOperationState: jest.fn(),
    setDraftRecovered: jest.fn(),
    setNotes: jest.fn(),
    setCustomer: jest.fn(),
    discardDraft: jest.fn(),
    markCommitted: jest.fn(),
    ...overrides,
  };
  return {
    ...result,
    operationOwnerScopeKey: Object.prototype.hasOwnProperty.call(overrides, 'operationOwnerScopeKey')
      ? overrides.operationOwnerScopeKey
      : result.operationId
        ? scopeKey
        : null,
  };
}

function scopedProps(tableId: string, sessionId: string, staffEmail: string) {
  return { tableId, sessionId, routeSessionId: sessionId, staffEmail };
}

function renderScopedHook() {
  return renderHook(
    ({ tableId, sessionId, routeSessionId, staffEmail }) => {
      mockAuth.mockReturnValue({ user: { email: staffEmail } });
      return useServerTableRound(
        tableId,
        state({ session: { serviceSessionId: sessionId } as ServerTableSessionState['session'] }),
        routeSessionId,
      );
    },
    { initialProps: scopedProps('T-QA/3', 'session-1', 'staff-a@example.test') },
  );
}

it('requires the route session id to match before composition is enabled', () => {
  const { result } = renderHook(() => useServerTableRound('T-QA/3', state(), undefined));
  expect(result.current.canCompose).toBe(false);
  expect(mockDraftHook).toHaveBeenCalledWith('T-QA/3', 'session-1', false, true);
});

it('does not send a round when its recovery descriptor cannot be stored', async () => {
  jest.mocked(persistServerTableRoundDraft).mockReturnValue(false);
  const { result } = renderHook(() => useServerTableRound('T-QA/3', state(), 'session-1'));

  await act(async () => result.current.review());

  expect(persistServerTableRoundDraft).toHaveBeenCalled();
  expect(mockReview).not.toHaveBeenCalled();
});

it('keeps a recovered unknown operation intact when discard and setters are invoked', () => {
  const recovered = draftMock('T-QA/3', 'session-1', 'staff-a@example.test', {
    operationId: 'operation-a',
    operationState: 'unknown',
    draftRecovered: true,
  });
  mockDraftHook.mockReturnValue(recovered);
  const { result } = renderScopedHook();

  act(() => {
    result.current.discardDraft();
    result.current.mutate(() => []);
    result.current.setItems([]);
    result.current.setNotes('new note');
    result.current.setCustomer({ customerUserId: 'user-b' } as never);
  });

  expect(recovered.discardDraft).not.toHaveBeenCalled();
  expect(recovered.mutate).not.toHaveBeenCalled();
  expect(recovered.setItems).not.toHaveBeenCalled();
  expect(recovered.setNotes).not.toHaveBeenCalled();
  expect(recovered.setCustomer).not.toHaveBeenCalled();
  expect(result.current.operationId).toBe('operation-a');
  expect(result.current.operationState).toBe('unknown');
});

it('blocks a captured discard and draft setters while async review is in flight', async () => {
  const pending = deferred<Awaited<ReturnType<typeof reviewServerTableRound>>>();
  mockReview.mockReturnValue(pending.promise);
  const draft = draftMock('T-QA/3', 'session-1', 'staff-a@example.test');
  mockDraftHook.mockReturnValue(draft);
  const { result } = renderScopedHook();
  const capturedDiscard = result.current.discardDraft;
  const capturedSetNotes = result.current.setNotes;
  let review!: Promise<void>;

  act(() => {
    review = result.current.review();
  });
  expect(result.current.phase).toBe('reviewing');
  act(() => {
    capturedDiscard();
    capturedSetNotes('changed during review');
    result.current.setItems([]);
    result.current.setCustomer({ customerUserId: 'user-b' } as never);
  });

  expect(draft.discardDraft).not.toHaveBeenCalled();
  expect(draft.setNotes).not.toHaveBeenCalled();
  expect(draft.setItems).not.toHaveBeenCalled();
  expect(draft.setCustomer).not.toHaveBeenCalled();

  await act(async () => {
    pending.resolve({ status: 'refused', operationId: 'operation-1', error: 'refused' });
    await review;
  });
  expect(result.current.phase).toBe('idle');
});

it('keeps composition locked until the current session draft has hydrated', () => {
  mockDraftHook.mockReturnValue({ items: [], operationState: 'idle', isReady: false, mutate: jest.fn() });
  const { result } = renderHook(() => useServerTableRound('T-QA/3', state(), 'session-1'));

  expect(result.current.canCompose).toBe(false);
});

it('masks prior customization and busy state in the first render of a new scope', () => {
  const snapshots: Array<ReturnType<typeof useServerTableRoundScopeState>> = [];
  const { result, rerender } = renderHook(
    ({ scopeKey }: { scopeKey: string }) => {
      const current = useServerTableRoundScopeState(scopeKey);
      snapshots.push(current);
      return current;
    },
    { initialProps: { scopeKey: 'scope-a' } },
  );

  act(() => {
    result.current.setPhase('reviewing');
    result.current.setError('old-scope-error');
    result.current.setSelectedProduct({ id: 'old-product', name: 'Soup' } as never);
    result.current.setSelectedBundle({ id: 'old-bundle' } as never);
    result.current.setTapPendingId('old-product');
  });
  expect(result.current.selectedProduct?.id).toBe('old-product');
  snapshots.length = 0;
  act(() => rerender({ scopeKey: 'scope-b' }));

  expect(snapshots[0]?.phase).toBe('idle');
  expect(snapshots[0]?.error).toBeNull();
  expect(snapshots[0]?.selectedProduct).toBeNull();
  expect(snapshots[0]?.selectedBundle).toBeNull();
  expect(snapshots[0]?.tapPendingId).toBeNull();
});

it('persists an operation before sending and auto-reconciles an unknown outcome', async () => {
  mockReview.mockResolvedValue({ status: 'unknown', operationId: 'operation-1' });
  mockReconcile.mockResolvedValue({
    status: 'committed',
    operationId: 'operation-1',
    order: { id: 'order-1', orderNumber: 'R-1' } as never,
  });
  jest.spyOn(crypto, 'randomUUID').mockReturnValue('operation-1');
  const { result } = renderHook(() => useServerTableRound('T-QA/3', state(), 'session-1'));

  await act(async () => result.current.review());

  expect(setOperationId).toHaveBeenCalledWith('operation-1');
  expect(persistServerTableRoundDraft).toHaveBeenCalledWith(
    expect.objectContaining({ tableId: 'T-QA/3', serviceSessionId: 'session-1', clientOperationId: 'operation-1' }),
    undefined,
  );
  expect(mockReconcile).toHaveBeenCalledWith('operation-1');
  expect(markCommitted).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }));
});

it('ignores product detail that resolves after staff identity changes', async () => {
  const pending = deferred<Awaited<ReturnType<typeof getProductById>>>();
  mockGetProduct.mockReturnValue(pending.promise);
  const draft = draftMock('T-QA/3', 'session-1', 'staff-a@example.test');
  const nextDraft = draftMock('T-QA/3', 'session-1', 'staff-b@example.test');
  mockDraftHook.mockReturnValue(draft);
  const { result, rerender } = renderScopedHook();
  const product = {
    id: 'p2',
    name: 'Soup',
    basePrice: 8,
    type: 'mainItem',
    isActive: true,
    isAvailable: true,
  } as never;
  let tap!: Promise<void>;

  act(() => {
    tap = result.current.tapProduct(product);
  });
  expect(result.current.canAddItems).toBe(false);
  mockDraftHook.mockReturnValue(nextDraft);
  await act(async () => rerender(scopedProps('T-QA/3', 'session-1', 'staff-b@example.test')));
  await act(async () => {
    pending.resolve({ success: true, data: { id: 'p2', name: 'Soup', basePrice: 8 } } as never);
    await tap;
  });

  expect(draft.mutate).not.toHaveBeenCalled();
  expect(result.current.tapPendingId).toBeNull();
  expect(result.current.phase).toBe('idle');
});

it('does not apply a review result to a different table after navigation', async () => {
  const pending = deferred<Awaited<ReturnType<typeof reviewServerTableRound>>>();
  mockReview.mockReturnValue(pending.promise);
  const tableA = draftMock('T-QA/3', 'session-1', 'staff-a@example.test');
  const tableB = draftMock('T-QA/4', 'session-1', 'staff-a@example.test');
  mockDraftHook.mockImplementation((tableId: string) => (tableId === 'T-QA/3' ? tableA : tableB));
  const { result, rerender } = renderScopedHook();
  let review!: Promise<void>;

  act(() => {
    review = result.current.review();
  });
  expect(result.current.phase).toBe('reviewing');
  expect(result.current.canAddItems).toBe(false);
  await act(async () => rerender(scopedProps('T-QA/4', 'session-1', 'staff-a@example.test')));
  await act(async () => {
    pending.resolve({
      status: 'committed',
      operationId: 'old-operation',
      order: { id: 'old-order', orderNumber: 'R-old' } as never,
    });
    await review;
  });

  expect(tableA.markCommitted).not.toHaveBeenCalled();
  expect(tableA.setQuote).not.toHaveBeenCalled();
  expect(tableB.markCommitted).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('idle');
});

it('keeps automatic reconciliation bound to the scope that reviewed the round', async () => {
  const reviewPending = deferred<Awaited<ReturnType<typeof reviewServerTableRound>>>();
  const reconcilePending = deferred<Awaited<ReturnType<typeof reconcileServerTableRound>>>();
  mockReview.mockReturnValue(reviewPending.promise);
  mockReconcile.mockReturnValue(reconcilePending.promise);
  const tableA = draftMock('T-QA/3', 'session-1', 'staff-a@example.test', { operationId: 'operation-a' });
  const tableB = draftMock('T-QA/4', 'session-1', 'staff-a@example.test');
  mockDraftHook.mockImplementation((tableId: string) => (tableId === 'T-QA/3' ? tableA : tableB));
  const { result, rerender } = renderScopedHook();
  let review!: Promise<void>;

  act(() => {
    review = result.current.review();
  });
  await act(async () => {
    reviewPending.resolve({ status: 'unknown', operationId: 'operation-a' });
    await Promise.resolve();
  });
  expect(mockReconcile).toHaveBeenCalledWith('operation-a');
  await act(async () => rerender(scopedProps('T-QA/4', 'session-1', 'staff-a@example.test')));
  await act(async () => {
    reconcilePending.resolve({ status: 'committed', operationId: 'operation-a', order: { id: 'old-order' } as never });
    await review;
  });

  expect(tableA.markCommitted).not.toHaveBeenCalled();
  expect(tableA.setOperationState).not.toHaveBeenCalled();
  expect(tableB.markCommitted).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('idle');
});

it('does not reconcile an old session into the newly active session', async () => {
  const pending = deferred<Awaited<ReturnType<typeof reconcileServerTableRound>>>();
  mockReconcile.mockReturnValue(pending.promise);
  const sessionA = draftMock('T-QA/3', 'session-1', 'staff-a@example.test', {
    operationId: 'operation-a',
    operationState: 'unknown',
  });
  const sessionB = draftMock('T-QA/3', 'session-2', 'staff-a@example.test');
  mockDraftHook.mockImplementation((_tableId: string, sessionId: string) =>
    sessionId === 'session-1' ? sessionA : sessionB,
  );
  const { result, rerender } = renderScopedHook();

  expect(result.current.canAddItems).toBe(false);
  let reconcile!: Promise<void>;
  act(() => {
    reconcile = result.current.reconcile();
  });
  expect(result.current.phase).toBe('reconciling');
  await act(async () => rerender(scopedProps('T-QA/3', 'session-2', 'staff-a@example.test')));
  await act(async () => {
    pending.resolve({ status: 'committed', operationId: 'operation-a', order: { id: 'old-order' } as never });
    await reconcile;
  });

  expect(sessionA.markCommitted).not.toHaveBeenCalled();
  expect(sessionA.setOperationState).not.toHaveBeenCalled();
  expect(sessionB.markCommitted).not.toHaveBeenCalled();
  expect(result.current.phase).toBe('idle');
});

it('refuses pre-hydration and foreign-owner reconciliation before passive effects', async () => {
  const scopeA = serverTableRoundScopeKey('T-QA/3', 'session-1', true, 'staff-a@example.test');
  const scopeB = serverTableRoundScopeKey('T-QA/4', 'session-1', true, 'staff-a@example.test');
  const draftA = draftMock('T-QA/3', 'session-1', 'staff-a@example.test', {
    operationId: 'operation-a',
    operationState: 'unknown',
  });
  let draftB = draftMock('T-QA/4', 'session-1', 'staff-a@example.test', {
    operationId: 'operation-a',
    operationState: 'unknown',
    isReady: false,
    operationOwnerScopeKey: scopeA,
  });
  mockDraftHook.mockImplementation((tableId: string) => (tableId === 'T-QA/3' ? draftA : draftB));
  mockReconcile.mockResolvedValue({ status: 'unknown', operationId: 'operation-a' });
  const { rerender } = renderHook(
    ({ tableId, sessionId, routeSessionId, staffEmail, attempt }) => {
      mockAuth.mockReturnValue({ user: { email: staffEmail } });
      const round = useServerTableRound(
        tableId,
        state({ session: { serviceSessionId: sessionId } as ServerTableSessionState['session'] }),
        routeSessionId,
      );
      const { reconcile } = round;
      useLayoutEffect(() => {
        if (attempt > 0) void reconcile();
      }, [attempt, reconcile]);
      return round;
    },
    { initialProps: { ...scopedProps('T-QA/3', 'session-1', 'staff-a@example.test'), attempt: 0 } },
  );

  await act(async () => rerender({ ...scopedProps('T-QA/4', 'session-1', 'staff-a@example.test'), attempt: 1 }));
  expect(mockReconcile).not.toHaveBeenCalled();

  draftB = draftMock('T-QA/4', 'session-1', 'staff-a@example.test', {
    operationId: 'operation-a',
    operationState: 'unknown',
    operationOwnerScopeKey: scopeA,
  });
  await act(async () => rerender({ ...scopedProps('T-QA/4', 'session-1', 'staff-a@example.test'), attempt: 2 }));
  expect(scopeB).not.toBe(scopeA);
  expect(mockReconcile).not.toHaveBeenCalled();
});
