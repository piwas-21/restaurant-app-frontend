import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type {
  GuestAccountPaymentAccount,
  GuestAccountPaymentOperation,
  GuestAccountCheckoutStatus,
  GuestPaymentReceipt,
} from '../../src/types/guestAccountPayments';
import type { TableGuestAccountDto, TableGuestVisitIdentity } from '../../src/types/tableGuestVisit';

const SERVICE_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000010';
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000020';
const ORDER_ID = '00000000-0000-4000-8000-000000000030';
const PARTICIPANT_TOKEN = 'served-browser-participant-token-0123456789';
const RECEIPT_CREDENTIAL = 'R'.repeat(43);
const CHECKOUT_PATH = `/api/table-guest-visits/${SERVICE_SESSION_ID}/account-payments/operations/${OPERATION_ID}/checkout`;
const OPERATION_PATH = `/api/table-guest-visits/${SERVICE_SESSION_ID}/account-payments/operations/${OPERATION_ID}`;
const TABLE_ACCOUNT_PATH = `/api/table-guest-visits/${SERVICE_SESSION_ID}/account`;
const PAYMENT_ACCOUNT_PATH = `/api/table-guest-visits/${SERVICE_SESSION_ID}/account-payments`;

test('served table-account recovers a captured return through validated GETs only', async ({ page }) => {
  const identity: TableGuestVisitIdentity = {
    serviceSessionId: SERVICE_SESSION_ID,
    participantToken: PARTICIPANT_TOKEN,
    expiresAt: '2030-01-01T00:00:00.000Z',
  };
  const operation = paymentOperation('Processing', 4);
  const participantFingerprint = createHash('sha256').update(PARTICIPANT_TOKEN).digest('hex');
  const snapshotFingerprint = createHash('sha256').update(snapshotJson(operation)).digest('hex');
  const descriptor = {
    serviceSessionId: SERVICE_SESSION_ID,
    operationId: OPERATION_ID,
    participantFingerprint,
    quote: {
      expectedAccountRevision: 7,
      mode: 'Amount' as const,
      paymentMethod: 'OnlinePayment' as const,
      amountMinor: 1500,
    },
    contribution: { amountMinor: 1500, currency: 'CHF', snapshotFingerprint },
    quotedVersion: 3,
    reservedExpectedVersion: 4,
    receiptCredential: RECEIPT_CREDENTIAL,
    startRequestedAt: Date.now(),
    attemptId: ATTEMPT_ID,
    receiptExpiresAt: null,
    receiptTerminalState: null,
    createdAt: Date.now(),
  };
  const paymentWrites: string[] = [];
  const operationReads: number[] = [];
  const checkoutReads: number[] = [];
  const receiptReads: number[] = [];
  const apiPaths: string[] = [];
  const browserErrors: string[] = [];
  const consoleErrors: string[] = [];
  let captured = false;

  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.addInitScript(
    ({ storedIdentity, storedDescriptor }) => {
      sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(storedIdentity));
      sessionStorage.setItem(
        'rumi_table_guest_payment_attempts_v1',
        JSON.stringify({ version: 1, attempts: [storedDescriptor] }),
      );
    },
    { storedIdentity: identity, storedDescriptor: descriptor },
  );

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    apiPaths.push(`${request.method()} ${path}`);
    if (
      path.startsWith(`/api/table-guest-visits/${SERVICE_SESSION_ID}/account-payments`) ||
      path.startsWith('/api/account-payment-receipts/')
    ) {
      if (request.method() !== 'GET') paymentWrites.push(`${request.method()} ${path}`);
    }

    if (path === '/api/tenant/features' && request.method() === 'GET') {
      await fulfillData(route, {
        tableGuestVisitsV1: true,
        tableAccountPaymentsV1: true,
        tableGuestAccountPaymentsV1: true,
      });
      return;
    }
    if (path === TABLE_ACCOUNT_PATH && request.method() === 'GET') {
      await fulfillData(route, tableAccount());
      return;
    }
    if (path === PAYMENT_ACCOUNT_PATH && request.method() === 'GET') {
      await fulfillData(route, paymentAccount(captured));
      return;
    }
    if (path === OPERATION_PATH && request.method() === 'GET') {
      const readCount = operationReads.length + 1;
      operationReads.push(readCount);
      await fulfillData(route, paymentOperation(captured ? 'Captured' : 'Processing', captured ? 5 : 4));
      return;
    }
    if (path === CHECKOUT_PATH && request.method() === 'GET') {
      const readCount = checkoutReads.length + 1;
      checkoutReads.push(readCount);
      await fulfillData(route, paymentCheckout(captured ? 'Captured' : 'Processing', captured ? 5 : 4));
      return;
    }
    if (path === `/api/account-payment-receipts/${ATTEMPT_ID}` && request.method() === 'GET') {
      receiptReads.push(receiptReads.length + 1);
      expect(request.headers()['x-account-payment-receipt']).toBe(RECEIPT_CREDENTIAL);
      const state = captured ? 'Captured' : 'Processing';
      await fulfillData(route, paymentReceipt(state));
      if (state === 'Processing') captured = true;
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false }) });
  });

  await page.goto(`/en/table-account?paymentAttempt=${ATTEMPT_ID}&canceled=0`);
  await expect(page.getByRole('heading', { name: 'Table account', exact: true })).toBeVisible();
  const receipt = page.getByRole('region', { name: 'Your contribution' });
  try {
    await expect(receipt).toContainText('Payment confirmed', { timeout: 20_000 });
  } catch (error) {
    throw new Error(
      `${String(error)}\nAPI paths: ${apiPaths.join(', ')}\nBrowser errors: ${browserErrors.join(' | ')}\nConsole errors: ${consoleErrors.join(' | ')}`,
    );
  }
  await expect(receipt).toContainText(/CHF\s*15\.00/);
  await expect(page.getByText('No unreserved order items are available.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/table-account$/);
  expect(operationReads.length).toBeGreaterThanOrEqual(2);
  expect(checkoutReads.length).toBeGreaterThanOrEqual(2);
  expect(receiptReads.length).toBeGreaterThanOrEqual(2);
  expect(paymentWrites).toEqual([]);
});

function snapshotJson(operation: GuestAccountPaymentOperation): string {
  return JSON.stringify({
    serviceSessionId: operation.serviceSessionId.toLowerCase(),
    operationId: operation.operationId.toLowerCase(),
    expectedAccountRevision: operation.expectedAccountRevision,
    mode: operation.mode,
    paymentMethod: operation.paymentMethod,
    amountMinor: operation.amountMinor,
    currency: operation.currency.toUpperCase(),
    quoteExpiresAt: operation.quoteExpiresAt,
    equalSharePlanId: operation.equalSharePlanId?.toLowerCase() ?? null,
    equalShareOrdinal: operation.equalShareOrdinal,
    allocations: operation.allocations.map((allocation) => ({
      orderId: allocation.orderId.toLowerCase(),
      orderItemId: allocation.orderItemId?.toLowerCase() ?? null,
      startOrdinal: allocation.startOrdinal,
      unitCount: allocation.unitCount,
      minorPerUnit: allocation.minorPerUnit,
      amountMinor: allocation.amountMinor,
    })),
  });
}

async function fulfillData(route: import('@playwright/test').Route, data: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

function paymentOperation(state: 'Processing' | 'Captured', version: number): GuestAccountPaymentOperation {
  return {
    serviceSessionId: SERVICE_SESSION_ID,
    operationId: OPERATION_ID,
    state,
    version,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'OnlinePayment',
    amountMinor: 1500,
    currency: 'CHF',
    quoteExpiresAt: '2030-01-01T00:05:00.000Z',
    reservedAt: '2030-01-01T00:00:00.000Z',
    reservationExpiresAt: '2030-01-01T00:10:00.000Z',
    equalSharePlanId: null,
    equalShareOrdinal: null,
    allocations: [
      { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 1500, amountMinor: 1500 },
    ],
  };
}

function paymentCheckout(state: 'Processing' | 'Captured', version: number): GuestAccountCheckoutStatus {
  return {
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    state,
    version,
    amountMinor: 1500,
    currency: 'CHF',
    expiresAt: '2030-01-01T00:10:00.000Z',
    checkoutUrl: null,
    reconciliationRequired: false,
    receivedMinor: state === 'Captured' ? 1500 : 0,
    refundedMinor: 0,
  };
}

function paymentReceipt(state: 'Processing' | 'Captured'): GuestPaymentReceipt {
  return {
    attemptId: ATTEMPT_ID,
    amountMinor: 1500,
    currency: 'CHF',
    state,
    receivedMinor: state === 'Captured' ? 1500 : 0,
    refundedMinor: 0,
    reconciliationRequired: false,
    completedAt: state === 'Captured' ? '2030-01-01T00:01:00.000Z' : null,
    receiptExpiresAt: null,
  };
}

function tableAccount(): TableGuestAccountDto {
  return {
    serviceSessionId: SERVICE_SESSION_ID,
    tableLabel: '12',
    currency: 'CHF',
    accountRevision: 7,
    subTotal: 15,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 15,
    totalPaid: 0,
    remaining: 15,
    credit: 0,
    orders: [],
    items: [],
  };
}

function paymentAccount(captured: boolean): GuestAccountPaymentAccount {
  return {
    serviceSessionId: SERVICE_SESSION_ID,
    status: 'Open',
    accountRevision: 7,
    currency: 'CHF',
    outstandingMinor: captured ? 0 : 1500,
    reservedMinor: captured ? 0 : 1500,
    availableMinor: 0,
    capturedAccountPaymentMinor: captured ? 1500 : 0,
    outstandingAllocations: captured
      ? []
      : [
          {
            orderId: ORDER_ID,
            orderItemId: null,
            startOrdinal: 1,
            unitCount: 1,
            minorPerUnit: 1500,
            amountMinor: 1500,
          },
        ],
    availableAllocations: [],
    activeEqualSharePlan: null,
    activeAttempts: [
      {
        operationId: OPERATION_ID,
        state: captured ? 'Captured' : 'Processing',
        version: captured ? 5 : 4,
        paymentMethod: 'OnlinePayment',
        amountMinor: 1500,
        currency: 'CHF',
        reservationExpiresAt: captured ? null : '2030-01-01T00:10:00.000Z',
        equalSharePlanId: null,
        equalShareOrdinal: null,
        isOwnOperation: true,
      },
    ],
    limits: {
      maximumSelectedUnits: 20,
      maximumEqualShares: 8,
      online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 5000 },
    },
  };
}
