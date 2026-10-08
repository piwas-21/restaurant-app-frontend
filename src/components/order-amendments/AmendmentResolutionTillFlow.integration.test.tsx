import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AmendmentResolutionModal from './AmendmentResolutionModal';
import { persistPendingAmendmentResolution, readPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import { resolutionIds } from '@/lib/__fixtures__/amendmentResolution';
import type {
  AmendmentResolutionQuote,
  AmendmentResolutionQuoteRequest,
  AmendmentResolutionResult,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

jest.unmock('@/utils/apiClient');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const fixedTime = '2026-10-08T12:00:00.000Z';
const manualAllocation = '61000000-0000-4000-8000-000000000006';
const manualPaymentId = resolutionIds.other;
const tillConfirmationPath = `/api/staff/amendment-financial-resolution-operations/${resolutionIds.operation}/confirm-till`;
const cashRefund = {
  policyVersion: 'chf-cash-5-rappen-v1',
  originalExactAmountMinor: 999,
  originalDueAmountMinor: 1000,
  previouslyRefundedExactMinor: 0,
  previouslyRefundedCashMinor: 0,
  exactRefundAmountMinor: 999,
  refundAdjustmentMinor: 1,
  cashRefundAmountMinor: 1000,
  retainedExactAmountMinor: 0,
  retainedCashDueMinor: 0,
} as const;

function quoteRequest(clientOperationId: string): AmendmentResolutionQuoteRequest {
  return {
    clientOperationId,
    expectedOrderVersion: 7,
    expectedAccountRevision: 9,
    currency: 'CHF',
    manualRefunds: [],
  };
}

function quoteFor(clientOperationId: string): AmendmentResolutionQuote {
  return {
    orderId: resolutionIds.order,
    amendmentId: resolutionIds.amendment,
    clientOperationId,
    quoteHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    currency: 'CHF',
    creditMinor: 1500,
    refundMinor: 1500,
    unpaidWaivedMinor: 0,
    refundLegs: [
      {
        paymentId: resolutionIds.payment,
        paymentMethod: 'OnlinePayment',
        custody: 'StripeDirect',
        amountMinor: 501,
        requiresTillConfirmation: false,
        scopes: [
          {
            allocationId: resolutionIds.allocation,
            orderItemId: resolutionIds.item,
            startOrdinal: 1,
            unitCount: 1,
            minorPerUnit: 501,
            amountMinor: 501,
          },
        ],
      },
      {
        paymentId: manualPaymentId,
        paymentMethod: 'Cash',
        custody: 'ManualTill',
        amountMinor: 999,
        requiresTillConfirmation: true,
        scopes: [
          {
            allocationId: manualAllocation,
            orderItemId: resolutionIds.item,
            startOrdinal: 1,
            unitCount: 1,
            minorPerUnit: 999,
            amountMinor: 999,
          },
        ],
        cashRefund,
      },
    ],
  };
}

function processingResult(clientOperationId: string): AmendmentResolutionResult {
  return {
    operationId: resolutionIds.operation,
    clientOperationId,
    amendmentId: resolutionIds.amendment,
    sourceOrderId: resolutionIds.order,
    state: 'Processing',
    currency: 'CHF',
    creditMinor: 1500,
    refundMinor: 1500,
    unpaidWaivedMinor: 0,
    startedAt: fixedTime,
    resolvedAt: null,
    refundLegs: [
      {
        paymentId: resolutionIds.payment,
        custody: 'StripeDirect',
        state: 'Succeeded',
        amountMinor: 501,
        resolvedAt: fixedTime,
        tillConfirmation: null,
      },
      {
        paymentId: manualPaymentId,
        custody: 'ManualTill',
        state: 'Pending',
        amountMinor: 999,
        resolvedAt: null,
        tillConfirmation: null,
        cashRefund,
      },
    ],
  };
}

function resolvedResult(clientOperationId: string, tillReference: string): AmendmentResolutionResult {
  return {
    ...processingResult(clientOperationId),
    state: 'Resolved',
    resolvedAt: fixedTime,
    refundLegs: [
      processingResult(clientOperationId).refundLegs[0]!,
      {
        paymentId: manualPaymentId,
        custody: 'ManualTill',
        state: 'Succeeded',
        amountMinor: 999,
        resolvedAt: fixedTime,
        tillConfirmation: { tillReference, confirmedAt: fixedTime },
        cashRefund,
        cashReturn: {
          exactRefundAmountMinor: 999,
          refundAdjustmentMinor: 1,
          cashReturnedMinor: 1000,
          confirmedAt: fixedTime,
        },
      },
    ],
  };
}

function pendingFixture(): PendingAmendmentResolution {
  const request = quoteRequest(resolutionIds.client);
  const reviewedQuote = quoteFor(request.clientOperationId);
  return {
    actorId: resolutionIds.actor,
    orderId: resolutionIds.order,
    amendmentId: resolutionIds.amendment,
    operationId: resolutionIds.operation,
    request: {
      quote: request,
      quoteHash: reviewedQuote.quoteHash,
      expiresAt: reviewedQuote.expiresAt,
    },
    reviewedQuote,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  } as Response;
}

interface CapturedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly body: unknown;
  readonly authorized: boolean;
}

function installApiTransport(mode: 'start' | 'lookup') {
  const calls: CapturedRequest[] = [];
  let requestBeforeStart: ReturnType<typeof readPendingAmendmentResolution> | undefined;
  let pendingAtTillPost: ReturnType<typeof readPendingAmendmentResolution> | undefined;
  let activeClientOperationId = resolutionIds.client;
  const transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      pathname: url.pathname,
      body,
      authorized: headers.get('Authorization') === 'Bearer test-token',
    });

    if (method === 'GET' && url.pathname.endsWith('/financial-resolution/context')) {
      return jsonResponse({
        orderId: resolutionIds.order,
        amendmentId: resolutionIds.amendment,
        expectedOrderVersion: 7,
        expectedAccountRevision: 9,
        currency: 'CHF',
        creditMinor: 1500,
        earningRetirementRequired: false,
        manualRefundCandidates: [],
      });
    }
    if (mode === 'start' && method === 'POST' && url.pathname.endsWith('/financial-resolution/quote')) {
      const clientOperationId = String(record(body).clientOperationId ?? '');
      activeClientOperationId = clientOperationId;
      return jsonResponse(quoteFor(clientOperationId));
    }
    if (mode === 'start' && method === 'POST' && url.pathname.endsWith('/financial-resolution')) {
      const startBody = record(body);
      const clientOperationId = String(record(startBody.quote).clientOperationId ?? '');
      activeClientOperationId = clientOperationId;
      requestBeforeStart = readPendingAmendmentResolution(
        resolutionIds.actor,
        resolutionIds.order,
        resolutionIds.amendment,
      );
      return jsonResponse({ outcome: 'accepted', result: processingResult(clientOperationId) });
    }
    if (mode === 'lookup' && method === 'GET' && url.pathname.includes('/financial-resolution/operations/')) {
      const clientOperationId = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
      activeClientOperationId = clientOperationId;
      return jsonResponse({ outcome: 'accepted', result: processingResult(clientOperationId) });
    }
    if (method === 'POST' && url.pathname.endsWith('/confirm-till')) {
      pendingAtTillPost = readPendingAmendmentResolution(
        resolutionIds.actor,
        resolutionIds.order,
        resolutionIds.amendment,
      );
      const confirmation = record(body);
      return jsonResponse(resolvedResult(activeClientOperationId, String(confirmation.tillReference ?? '')));
    }
    throw new Error(`Unexpected API request in till flow test: ${method} ${url.pathname}`);
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: transport });
  return { calls, requestBeforeStart: () => requestBeforeStart, pendingAtTillPost: () => pendingAtTillPost };
}

function renderModal() {
  return render(
    <AmendmentResolutionModal
      actorId={resolutionIds.actor}
      orderId={resolutionIds.order}
      amendmentId={resolutionIds.amendment}
      enabled
      onChanged={jest.fn()}
      onClose={jest.fn()}
    />,
  );
}

async function submitPhysicalRefund(): Promise<void> {
  await screen.findByRole('button', { name: 'orderAmendments.resolution_confirm_till' });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'P11-MIXED-999' } });
  const cashReturn = screen.getByRole('checkbox', { name: 'orderAmendments.resolution_cash_return_checkbox' });
  const acknowledgement = screen.getByRole('checkbox', { name: 'orderAmendments.resolution_acknowledge_till' });
  fireEvent.click(cashReturn);
  fireEvent.click(acknowledgement);
  fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm_till' }));
  await screen.findByText('orderAmendments.resolution_resolved');
}

describe('mixed Stripe and cash till resolution through the real modal flow', () => {
  let originalFetch: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('auth_token', 'test-token');
    window.history.replaceState({}, '', '/en/table-account');
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
    else Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('submits one exact till confirmation after a fresh quote and accepted Start', async () => {
    const api = installApiTransport('start');
    expect(window.localStorage.getItem('auth_token')).toBe('test-token');
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: 'orderAmendments.resolution_review' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'orderAmendments.resolution_acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm' }));
    await submitPhysicalRefund();

    const quoteCalls = api.calls.filter((call) => call.method === 'POST' && call.pathname.endsWith('/quote'));
    const startCalls = api.calls.filter(
      (call) => call.method === 'POST' && call.pathname.endsWith('/financial-resolution'),
    );
    const tillCalls = api.calls.filter((call) => call.method === 'POST' && call.pathname.endsWith('/confirm-till'));
    expect(quoteCalls).toHaveLength(1);
    expect(startCalls).toHaveLength(1);
    expect(tillCalls).toHaveLength(1);
    expect(tillCalls.map((call) => call.pathname)).toEqual([tillConfirmationPath]);
    expect(api.calls.every((call) => call.authorized)).toBe(true);
    expect(record(tillCalls[0]?.body)).toEqual({
      paymentId: manualPaymentId,
      tillReference: 'P11-MIXED-999',
      cashReturnedMinor: 1000,
    });
    expect(api.requestBeforeStart()).toMatchObject({ status: 'pending', value: { operationId: null } });
    expect(api.pendingAtTillPost()).toMatchObject({
      status: 'pending',
      value: {
        operationId: resolutionIds.operation,
        pendingTillConfirmations: [
          { paymentId: manualPaymentId, tillReference: 'P11-MIXED-999', cashReturnedMinor: 1000 },
        ],
      },
    });
    expect(readPendingAmendmentResolution(resolutionIds.actor, resolutionIds.order, resolutionIds.amendment)).toEqual({
      status: 'none',
    });
  });

  it('restores the accepted operation by lookup and submits the same exact till confirmation once', async () => {
    const pending = pendingFixture();
    expect(persistPendingAmendmentResolution(pending)).toBe(true);
    const api = installApiTransport('lookup');
    renderModal();
    await submitPhysicalRefund();

    expect(api.calls.filter((call) => call.method === 'GET' && call.pathname.includes('/operations/'))).toHaveLength(1);
    expect(api.calls.filter((call) => call.method === 'POST' && call.pathname.endsWith('/quote'))).toHaveLength(0);
    expect(
      api.calls.filter((call) => call.method === 'POST' && call.pathname.endsWith('/financial-resolution')),
    ).toHaveLength(0);
    const tillCalls = api.calls.filter((call) => call.method === 'POST' && call.pathname.endsWith('/confirm-till'));
    expect(tillCalls).toHaveLength(1);
    expect(tillCalls.map((call) => call.pathname)).toEqual([tillConfirmationPath]);
    expect(api.calls.every((call) => call.authorized)).toBe(true);
    expect(record(tillCalls[0]?.body)).toEqual({
      paymentId: manualPaymentId,
      tillReference: 'P11-MIXED-999',
      cashReturnedMinor: 1000,
    });
    expect(api.pendingAtTillPost()).toMatchObject({
      status: 'pending',
      value: {
        operationId: resolutionIds.operation,
        pendingTillConfirmations: [
          { paymentId: manualPaymentId, tillReference: 'P11-MIXED-999', cashReturnedMinor: 1000 },
        ],
      },
    });
    await waitFor(() =>
      expect(readPendingAmendmentResolution(resolutionIds.actor, resolutionIds.order, resolutionIds.amendment)).toEqual(
        {
          status: 'none',
        },
      ),
    );
  });
});
