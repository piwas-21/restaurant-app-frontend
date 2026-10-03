import { apiClient } from '@/utils/apiClient';
import {
  commitOrderAmendment,
  getOrderAmendmentHistory,
  lookupOrderAmendmentOperation,
  quoteOrderAmendment,
} from './orderAmendmentsService';
import type {
  OrderAmendmentCommitResult,
  OrderAmendmentQuote,
  OrderAmendmentQuoteRequest,
} from '@/types/orderAmendment';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

describe('orderAmendmentsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts an immutable quote request for the exact source order', async () => {
    const request: OrderAmendmentQuoteRequest = {
      expectedOrderVersion: 7,
      expectedAccountRevision: 13,
      reason: 'Guest changed the side',
      reviewAcknowledged: false,
      preparingOverrideAcknowledged: true,
      releaseAdditionsToKitchen: true,
      localProviderSupplementConsent: false,
      additions: [],
      changes: [{ orderItemId: 'root-line', kind: 'Void', startOrdinal: 2, quantity: 1 }],
    };
    const quote = {
      amendmentId: 'amendment-1',
      sourceOrderId: 'order/1',
      sourceOrder: { items: [] },
      changes: [],
    } as unknown as OrderAmendmentQuote;
    mockPost.mockResolvedValue({ success: true, data: quote });

    await expect(quoteOrderAmendment('order/1', request)).resolves.toEqual(quote);
    expect(mockPost).toHaveBeenCalledWith('/api/staff/orders/order%2F1/amendments/quote', request, {
      requireAuth: true,
    });
  });

  it('normalizes nullable menu-backed IDs in amendment source, supplement, change, and nested item snapshots', async () => {
    const menuItem = {
      id: 'menu-line-1',
      productId: null,
      menuID: 'menu-1',
      productName: 'Lunch menu',
      quantity: 1,
      unitPrice: 18,
      itemTotal: 18,
      sideItems: [
        {
          id: 'menu-side-1',
          productId: null,
          menuID: 'menu-side-1',
          productName: 'Menu side',
          quantity: 1,
          unitPrice: 0,
          itemTotal: 0,
          sideItems: [],
        },
      ],
    };
    const menuOrder = { id: 'order-1', items: [menuItem] };
    const menuQuote = {
      amendmentId: 'amendment-1',
      sourceOrderId: 'order/1',
      sourceOrder: menuOrder,
      supplementOrder: menuOrder,
      changes: [
        {
          orderItemId: 'line-1',
          kind: 'Replace',
          previous: menuItem,
          current: menuItem,
        },
      ],
    };
    mockPost.mockResolvedValue({ success: true, data: menuQuote });

    const normalized = await quoteOrderAmendment('order/1', {
      expectedOrderVersion: 7,
      reviewAcknowledged: false,
      preparingOverrideAcknowledged: false,
      releaseAdditionsToKitchen: true,
      localProviderSupplementConsent: false,
      additions: [],
      changes: [],
    });

    for (const item of [
      normalized.sourceOrder.items[0],
      normalized.supplementOrder?.items[0],
      normalized.changes[0].previous,
      normalized.changes[0].current,
    ]) {
      expect(item).toMatchObject({ productId: '', menuId: 'menu-1' });
      expect(item?.sideItems?.[0]).toMatchObject({ productId: '', menuId: 'menu-side-1' });
    }
  });

  it('commits with the same operation identity and looks it up on the absolute route', async () => {
    const commit: OrderAmendmentCommitResult = {
      amendmentId: 'amendment-1',
      clientOperationId: 'operation-1',
      sourceOrderId: 'order-1',
      committedAt: '2026-10-02T11:00:00Z',
      financialResolution: {
        currency: 'CHF',
        addedAmountMinor: 0,
        removedUnitValueMinor: 0,
        netAccountDeltaMinor: 0,
        potentialCreditMinor: 0,
        resolutionStatus: 'NotRequired',
        creditState: 'None',
        loyaltyState: 'None',
        refundState: 'None',
      },
    };
    mockPost.mockResolvedValue({ success: true, data: commit });
    mockGet.mockResolvedValue({
      success: true,
      data: { operationId: 'operation-1', status: 'Committed', result: commit },
    });

    await expect(
      commitOrderAmendment('order-1', {
        amendmentId: 'amendment-1',
        clientOperationId: 'operation-1',
        expectedOrderVersion: 7,
        expectedAccountRevision: 13,
        reviewAcknowledged: true,
      }),
    ).resolves.toEqual(commit);
    await expect(lookupOrderAmendmentOperation('operation-1')).resolves.toMatchObject({ status: 'Committed' });
    expect(mockPost.mock.calls[0][0]).toBe('/api/staff/orders/order-1/amendments/commit');
    expect(mockGet.mock.calls[0][0]).toBe('/api/staff/amendment-operations/operation-1');
  });

  it('normalizes menu identities in commit, replay lookup, and history snapshots', async () => {
    const menuItem = {
      id: 'menu-line-1',
      productId: null,
      menuID: 'menu-1',
      quantity: 1,
      unitPrice: 18,
      itemTotal: 18,
      sideItems: [],
    };
    const supplementOrder = { id: 'supplement-1', items: [menuItem] };
    const financialResolution = {
      addedAmountMinor: 0,
      removedUnitValueMinor: 0,
      netAccountDeltaMinor: 0,
      potentialCreditMinor: 0,
      resolutionStatus: 'NotRequired',
      creditState: 'None',
      loyaltyState: 'None',
      refundState: 'None',
    };
    const commit = {
      amendmentId: 'amendment-1',
      clientOperationId: 'operation-1',
      sourceOrderId: 'order-1',
      committedAt: '2026-10-02T11:00:00Z',
      financialResolution,
      supplementOrder,
    } as unknown as OrderAmendmentCommitResult;
    mockPost.mockResolvedValue({ success: true, data: commit });

    const committed = await commitOrderAmendment('order-1', {
      amendmentId: 'amendment-1',
      clientOperationId: 'operation-1',
      expectedOrderVersion: 7,
      reviewAcknowledged: true,
    });
    expect(committed.supplementOrder?.items[0]).toMatchObject({ productId: '', menuId: 'menu-1' });

    mockGet.mockResolvedValue({
      success: true,
      data: { operationId: 'operation-1', status: 'Committed', result: commit },
    });
    const lookup = await lookupOrderAmendmentOperation('operation-1');
    expect(lookup.result?.supplementOrder?.items[0]).toMatchObject({ productId: '', menuId: 'menu-1' });

    const history = [
      {
        amendmentId: 'amendment-1',
        sourceOrderId: 'order-1',
        actorRole: 'Cashier',
        state: 'Committed',
        createdAt: '2026-10-02T11:00:00Z',
        supplementOrder,
        changes: [
          {
            orderItemId: 'line-1',
            kind: 'Replace',
            startOrdinal: 1,
            quantity: 1,
            wholeLine: true,
            previous: menuItem,
            current: menuItem,
          },
        ],
        financialResolution,
      },
    ];
    mockGet.mockResolvedValue({ success: true, data: history });
    const records = await getOrderAmendmentHistory('order-1');
    expect(records[0].supplementOrder?.items[0]).toMatchObject({ productId: '', menuId: 'menu-1' });
    expect(records[0].changes[0].previous).toMatchObject({ productId: '', menuId: 'menu-1' });
  });

  it('reads source amendment history without changing order state', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });

    await expect(getOrderAmendmentHistory('order-1')).resolves.toEqual([]);
    expect(mockGet).toHaveBeenCalledWith('/api/staff/orders/order-1/amendments', { requireAuth: true });
  });
});
