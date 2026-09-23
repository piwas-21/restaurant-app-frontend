import { act, renderHook } from '@testing-library/react';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import { persistServerTableRoundDraft } from '@/lib/serverTableRoundDraft';
import { reconcileServerTableRound, reviewServerTableRound } from './serverTableRoundReview';
import { useServerTableRoundDraft } from './useServerTableRoundDraft';
import { useServerTableRoundCatalog } from './useServerTableRoundCatalog';
import { useServerTableRound } from './useServerTableRound';

jest.mock('@/lib/serverTableRoundDraft', () => ({ persistServerTableRoundDraft: jest.fn() }));
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
    items: [{ product: { id: 'p1', name: 'Tea' }, quantity: 1, unitPrice: 8 }],
    notes: '',
    operationId: undefined,
    quote: null,
    createdOrder: null,
    operationState: 'idle',
    draftRecovered: false,
    mutate: jest.fn(),
    setOperationId,
    setQuote,
    setOperationState,
    setDraftRecovered,
    markCommitted,
    setNotes: jest.fn(),
    discardDraft: jest.fn(),
  });
});

it('requires the route session id to match before composition is enabled', () => {
  const { result } = renderHook(() => useServerTableRound('T-QA/3', state(), undefined));
  expect(result.current.canCompose).toBe(false);
  expect(mockDraftHook).toHaveBeenCalledWith('T-QA/3', 'session-1', false, true);
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
