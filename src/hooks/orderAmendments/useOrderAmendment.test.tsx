import { act, renderHook } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentCommitResult, OrderAmendmentQuote } from '@/types/orderAmendment';
import { getServerOrderById } from '@/services/server/orders';
import { getTableServiceSession } from '@/services/tableServiceSessionService';
import {
  commitOrderAmendment,
  lookupOrderAmendmentOperation,
  quoteOrderAmendment,
} from '@/services/orderAmendmentsService';
import { useOrderAmendment } from './useOrderAmendment';

jest.mock('@/services/server/orders', () => ({ getServerOrderById: jest.fn() }));
jest.mock('@/components/AuthContext', () => ({
  useOptionalAuth: () => ({ user: { userId: 'actor-1' } }),
}));
jest.mock('@/services/tableServiceSessionService', () => ({ getTableServiceSession: jest.fn() }));
jest.mock('@/services/orderAmendmentsService', () => ({
  commitOrderAmendment: jest.fn(),
  lookupOrderAmendmentOperation: jest.fn(),
  quoteOrderAmendment: jest.fn(),
}));

const mockOrderRead = getServerOrderById as jest.Mock;
const mockSessionRead = getTableServiceSession as jest.Mock;
const mockQuote = quoteOrderAmendment as jest.Mock;
const mockCommit = commitOrderAmendment as jest.Mock;
const mockLookup = lookupOrderAmendmentOperation as jest.Mock;

const order = (overrides: Partial<OrderDto> = {}) =>
  ({
    id: 'order-1',
    orderNumber: 'A-001',
    type: 'DineIn',
    serviceSessionId: 'visit-1',
    version: 7,
    status: 'Preparing',
    paymentStatus: 'PartiallyPaid',
    externalOrder: null,
    items: [],
    ...overrides,
  }) as OrderDto;

const draft = {
  additions: [],
  changes: [{ orderItemId: 'root-line', kind: 'Void' as const, startOrdinal: 2, quantity: 1 }],
  reason: 'Guest changed their choice',
  preparingOverrideAcknowledged: true,
  releaseAdditionsToKitchen: true,
  localProviderSupplementConsent: false,
  providerConsentNote: '',
};

const quote = (sourceOrderId = 'order-1') =>
  ({
    amendmentId: 'amendment-1',
    sourceOrderId,
    expectedOrderVersion: 7,
    expectedAccountRevision: 12,
    expiresAt: '2099-01-01T00:00:00Z',
  }) as OrderAmendmentQuote;

const committed = {
  amendmentId: 'amendment-1',
  clientOperationId: 'operation-1',
  sourceOrderId: 'order-1',
  committedAt: '2026-10-02T12:00:00Z',
  financialResolution: {},
} as unknown as OrderAmendmentCommitResult;

function resultFor(request: { amendmentId: string; clientOperationId: string }) {
  return {
    ...committed,
    amendmentId: request.amendmentId,
    clientOperationId: request.clientOperationId,
    sourceOrderId: 'order-1',
  };
}

describe('useOrderAmendment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockOrderRead.mockResolvedValue(order());
    mockSessionRead.mockResolvedValue({ serviceSessionId: 'visit-1', status: 'Open', accountRevision: 12 });
    mockQuote.mockResolvedValue(quote());
    mockCommit.mockImplementation((_orderId: string, request: { amendmentId: string; clientOperationId: string }) =>
      Promise.resolve(resultFor(request)),
    );
  });

  it('fails closed when the rendered order version is stale', async () => {
    mockOrderRead.mockResolvedValue(order({ version: 8 }));
    const { result } = renderHook(() => useOrderAmendment(order()));

    await act(async () => result.current.prepareQuote(draft));

    expect(result.current.error).toBe('orderAmendments.order_changed_refresh');
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockSessionRead).not.toHaveBeenCalled();
  });

  it('quotes the exact source line range against the fresh visit revision', async () => {
    const { result } = renderHook(() => useOrderAmendment(order()));

    await act(async () => result.current.prepareQuote(draft));

    expect(mockQuote).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        expectedOrderVersion: 7,
        expectedAccountRevision: 12,
        preparingOverrideAcknowledged: true,
        changes: [{ orderItemId: 'root-line', kind: 'Void', startOrdinal: 2, quantity: 1 }],
      }),
    );
    expect(result.current.phase).toBe('review');
  });

  it('requires exact DineIn visit identity instead of quoting by a table label', async () => {
    const { result } = renderHook(() => useOrderAmendment(order({ serviceSessionId: null, tableLabel: 'T9' })));
    mockOrderRead.mockResolvedValue(order({ serviceSessionId: null, tableLabel: 'T9' }));

    await act(async () => result.current.prepareQuote(draft));

    expect(result.current.error).toBe('orderAmendments.visit_unavailable');
    expect(mockSessionRead).not.toHaveBeenCalled();
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('keeps the same operation ID and payload after a lost commit response', async () => {
    mockCommit.mockRejectedValueOnce(new Error('network response lost'));
    mockLookup.mockImplementation((operationId: string) => Promise.resolve({ operationId, status: 'Unknown' }));
    const { result } = renderHook(() => useOrderAmendment(order()));

    await act(async () => result.current.prepareQuote(draft));
    await act(async () => result.current.commit());
    expect(result.current.phase).toBe('uncertain');
    expect(result.current.canRetrySameCommit).toBe(true);

    const originalRequest = mockCommit.mock.calls[0][1];
    await act(async () => result.current.retrySameCommit());

    expect(mockCommit).toHaveBeenNthCalledWith(2, 'order-1', originalRequest);
    expect(mockCommit.mock.calls[1][1]).toEqual(originalRequest);
    expect(result.current.phase).toBe('committed');
  });

  it('recovers the committed operation after a reload without quoting or committing again', async () => {
    let committedOperation: ReturnType<typeof resultFor> | null = null;
    mockCommit.mockImplementationOnce(
      (_orderId: string, request: { amendmentId: string; clientOperationId: string }) => {
        committedOperation = resultFor(request);
        return Promise.reject(new Error('server committed but response was lost'));
      },
    );
    mockLookup
      .mockRejectedValueOnce(new Error('lookup temporarily unavailable'))
      .mockImplementationOnce((operationId: string) =>
        Promise.resolve({ operationId, status: 'Committed', result: committedOperation }),
      );

    const first = renderHook(() => useOrderAmendment(order()));
    await act(async () => first.result.current.prepareQuote(draft));
    await act(async () => first.result.current.commit());
    expect(first.result.current.phase).toBe('uncertain');
    const originalRequest = mockCommit.mock.calls[0][1];
    first.unmount();

    const recovered = renderHook(() => useOrderAmendment(order()));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(recovered.result.current.phase).toBe('committed');
    expect(recovered.result.current.clientOperationId).toBe(originalRequest.clientOperationId);
    expect(mockLookup).toHaveBeenLastCalledWith(originalRequest.clientOperationId);
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  it('guards rapid double invocation so one quote creates one operation ID and one commit', async () => {
    const { result } = renderHook(() => useOrderAmendment(order()));
    await act(async () => result.current.prepareQuote(draft));

    await act(async () => {
      await Promise.all([result.current.commit(), result.current.commit()]);
    });

    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockCommit.mock.calls[0][1].clientOperationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('passes explicit provider supplement consent and blocks provider source changes', async () => {
    const providerOrder = order({
      type: 'Delivery',
      serviceSessionId: null,
      externalOrder: {} as OrderDto['externalOrder'],
    });
    const { result } = renderHook(() => useOrderAmendment(providerOrder));
    const providerDraft = {
      ...draft,
      changes: [],
      additions: [{ productId: 'menu-item', quantity: 1, unitPrice: 5 }],
      localProviderSupplementConsent: true,
      providerConsentNote: 'Call marketplace support after local preparation.',
    };

    await act(async () => result.current.prepareQuote(providerDraft));
    expect(mockQuote).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        localProviderSupplementConsent: true,
        providerConsentNote: 'Call marketplace support after local preparation.',
      }),
    );

    mockOrderRead.mockResolvedValue(providerOrder);
    const sourceChangeHook = renderHook(() => useOrderAmendment(providerOrder));
    await act(async () => sourceChangeHook.result.current.prepareQuote(draft));
    expect(sourceChangeHook.result.current.error).toBe('orderAmendments.provider_changes_blocked');
  });
});
