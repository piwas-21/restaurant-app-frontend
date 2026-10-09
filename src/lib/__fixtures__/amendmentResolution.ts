import type {
  AmendmentResolutionRefusal,
  AmendmentResolutionResult,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

export const resolutionIds = {
  actor: '10000000-0000-4000-8000-000000000001',
  order: '20000000-0000-4000-8000-000000000002',
  amendment: '30000000-0000-4000-8000-000000000003',
  client: '40000000-0000-4000-8000-000000000004',
  payment: '50000000-0000-4000-8000-000000000005',
  allocation: '60000000-0000-4000-8000-000000000006',
  item: '70000000-0000-4000-8000-000000000007',
  operation: '80000000-0000-4000-8000-000000000008',
  other: '90000000-0000-4000-8000-000000000009',
};

export function pendingResolutionFixture(): PendingAmendmentResolution {
  const quote = {
    clientOperationId: resolutionIds.client,
    expectedOrderVersion: 5,
    expectedAccountRevision: 9,
    currency: 'CHF',
    manualRefunds: [],
  };
  return {
    actorId: resolutionIds.actor,
    orderId: resolutionIds.order,
    amendmentId: resolutionIds.amendment,
    operationId: null,
    request: {
      quote,
      quoteHash: 'a'.repeat(64),
      expiresAt: '2026-10-03T16:00:00Z',
    },
    reviewedQuote: {
      orderId: resolutionIds.order,
      amendmentId: resolutionIds.amendment,
      clientOperationId: resolutionIds.client,
      quoteHash: 'a'.repeat(64),
      expiresAt: '2026-10-03T16:00:00Z',
      currency: 'CHF',
      creditMinor: 1_000,
      refundMinor: 400,
      unpaidWaivedMinor: 600,
      refundLegs: [
        {
          paymentId: resolutionIds.payment,
          paymentMethod: 'OnlinePayment',
          custody: 'StripeDirect',
          amountMinor: 400,
          requiresTillConfirmation: false,
          scopes: [
            {
              allocationId: resolutionIds.allocation,
              orderItemId: resolutionIds.item,
              startOrdinal: 2,
              unitCount: 1,
              minorPerUnit: 400,
              amountMinor: 400,
            },
          ],
        },
      ],
    },
  };
}

export function resolutionResultFixture(): AmendmentResolutionResult {
  return {
    operationId: resolutionIds.operation,
    clientOperationId: resolutionIds.client,
    amendmentId: resolutionIds.amendment,
    sourceOrderId: resolutionIds.order,
    state: 'Resolved',
    currency: 'CHF',
    creditMinor: 1_000,
    refundMinor: 400,
    unpaidWaivedMinor: 600,
    startedAt: '2026-10-03T15:59:00Z',
    resolvedAt: '2026-10-03T16:01:00Z',
    refundLegs: [
      {
        paymentId: resolutionIds.payment,
        custody: 'StripeDirect',
        state: 'Succeeded',
        amountMinor: 400,
        resolvedAt: '2026-10-03T16:00:30Z',
      },
    ],
  };
}

export function resolutionRefusalFixture(pending = pendingResolutionFixture()): AmendmentResolutionRefusal {
  return {
    actorUserId: pending.actorId,
    orderId: pending.orderId,
    amendmentId: pending.amendmentId,
    clientOperationId: pending.request.quote.clientOperationId,
    requestHash: 'b'.repeat(64),
    failureCode: 'sourceVersionConflict',
    createdAt: '2026-10-03T16:00:01Z',
    originalRequest: pending.request,
  };
}
