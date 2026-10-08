import { expect, test, type Route } from '@playwright/test';
import type {
  GuestAccountPaymentAccount,
  GuestEqualSharePlan,
  GuestPaymentEqualShareSummary,
} from '../../src/types/guestAccountPayments';
import type { TableGuestAccountDto, TableGuestVisitIdentity } from '../../src/types/tableGuestVisit';

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

const SERVICE_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const ORDER_ID = '00000000-0000-4000-8000-000000000010';
const ITEM_ID = '00000000-0000-4000-8000-000000000020';
const PLAN_ID = '00000000-0000-4000-8000-000000000030';
const PARTICIPANT_TOKEN = 'offline-synthetic-participant-token-0123456789';
const PAYMENT_PATH = `/api/table-guest-visits/${SERVICE_SESSION_ID}/account-payments`;
const TABLE_ACCOUNT_PATH = `/api/table-guest-visits/${SERVICE_SESSION_ID}/account`;
const PLAN_PATH = `${PAYMENT_PATH}/equal-share-plans`;

const scope = [
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 2, unitCount: 1, minorPerUnit: 999, amountMinor: 999 },
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 3, unitCount: 1, minorPerUnit: 1500, amountMinor: 1500 },
];

const summary: GuestPaymentEqualShareSummary = {
  planId: PLAN_ID,
  accountRevision: 10,
  totalMinor: 2499,
  shareCount: 2,
  currency: 'CHF',
  isOwnPlan: true,
  scope,
  slots: [
    { ordinal: 1, amountMinor: 1250, isAvailable: true, claimState: null },
    { ordinal: 2, amountMinor: 1249, isAvailable: true, claimState: null },
  ],
};

const accountBeforePlan: GuestAccountPaymentAccount = {
  serviceSessionId: SERVICE_SESSION_ID,
  status: 'Open',
  accountRevision: 10,
  currency: 'CHF',
  outstandingMinor: 2499,
  reservedMinor: 0,
  availableMinor: 2499,
  capturedAccountPaymentMinor: 2001,
  outstandingAllocations: scope,
  availableAllocations: scope,
  activeEqualSharePlan: null,
  activeAttempts: [],
  limits: {
    maximumSelectedUnits: 20,
    maximumEqualShares: 8,
    online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 5000 },
  },
};

const accountAfterPlan: GuestAccountPaymentAccount = {
  ...accountBeforePlan,
  activeEqualSharePlan: summary,
};

const identity: TableGuestVisitIdentity = {
  serviceSessionId: SERVICE_SESSION_ID,
  participantToken: PARTICIPANT_TOKEN,
  expiresAt: '2099-01-01T00:00:00.000Z',
};

const tableAccount: TableGuestAccountDto = {
  serviceSessionId: SERVICE_SESSION_ID,
  tableLabel: '12',
  currency: 'CHF',
  accountRevision: 10,
  subTotal: 45,
  tax: 0,
  discount: 0,
  tip: 0,
  total: 45,
  totalPaid: 20.01,
  remaining: 24.99,
  credit: 0,
  orders: [],
  items: [],
};

test('preserves equal-share selection while a saved plan is pending and after account refresh', async ({ page }) => {
  const paymentWrites: string[] = [];
  let accountReadsAfterPlan = 0;
  let planPostCount = 0;
  let planCreated = false;
  let resolvePlanRequest: () => void = () => undefined;
  let releasePlanResponse: () => void = () => undefined;
  const planRequestSeen = new Promise<void>((resolve) => {
    resolvePlanRequest = resolve;
  });
  const planResponseGate = new Promise<void>((resolve) => {
    releasePlanResponse = resolve;
  });

  await page.addInitScript((storedIdentity) => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(storedIdentity));
  }, identity);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === '/api/tenant/features' && request.method() === 'GET') {
      await fulfillData(route, {
        tableGuestVisitsV1: true,
        tableAccountPaymentsV1: true,
        tableGuestAccountPaymentsV1: true,
      });
      return;
    }
    if (pathname === TABLE_ACCOUNT_PATH && request.method() === 'GET') {
      await fulfillData(route, tableAccount);
      return;
    }
    if (pathname === PAYMENT_PATH && request.method() === 'GET') {
      if (planCreated) accountReadsAfterPlan += 1;
      await fulfillData(route, planCreated ? accountAfterPlan : accountBeforePlan);
      return;
    }
    if (pathname === PLAN_PATH && request.method() === 'POST') {
      planPostCount += 1;
      paymentWrites.push('equal-share-plan');
      planCreated = true;
      const body = request.postDataJSON() as {
        operationId: string;
        expectedAccountRevision: number;
        shareCount: number;
      };
      resolvePlanRequest();
      await planResponseGate;
      const plan: GuestEqualSharePlan = {
        serviceSessionId: SERVICE_SESSION_ID,
        operationId: body.operationId,
        planId: PLAN_ID,
        accountRevision: body.expectedAccountRevision,
        totalMinor: 2499,
        shareCount: body.shareCount,
        currency: 'CHF',
        createdAt: '2026-10-08T00:00:00.000Z',
        invalidatedAt: null,
        scope,
      };
      await fulfillData(route, plan);
      return;
    }
    if (pathname.startsWith(PAYMENT_PATH) && request.method() !== 'GET') {
      paymentWrites.push(pathname.endsWith('/equal-share-plans') ? 'equal-share-plan' : 'unexpected');
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false }) });
  });

  try {
    await page.goto('/en/table-account');
    const panel = page.getByRole('region', { name: 'Contribute to the table account', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();

    const equalMode = panel.getByRole('radio', { name: 'Equal share', exact: true });
    await equalMode.check();
    await panel.getByLabel('Number of shares', { exact: true }).fill('2');
    const createPlan = panel.getByRole('button', { name: 'Create or update shares', exact: true });
    await Promise.all([createPlan.click(), planRequestSeen]);

    await expect(page.getByText(/An equal-share change is awaiting confirmation/)).toBeVisible();
    await expect(equalMode).toBeVisible();
    await expect(equalMode).toBeChecked();
    const reviewButton = panel.getByRole('button', { name: 'Review contribution', exact: true });
    const createPlanButton = panel.getByRole('button', { name: 'Create or update shares', exact: true });
    await expect(reviewButton).toBeDisabled();
    await expect(createPlanButton).toBeDisabled();

    const planResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return new URL(response.url()).pathname === PLAN_PATH && request.method() === 'POST';
    });
    releasePlanResponse();
    const planResponse = await planResponsePromise;
    expect(planResponse.status()).toBe(200);
    await expect(reviewButton).toBeEnabled();
    await expect(equalMode).toBeVisible();
    await expect(equalMode).toBeChecked();
    const firstShare = panel.getByRole('radio', { name: /^Share 1 ·/ });
    await expect(firstShare).toBeVisible();
    await expect(firstShare).toHaveAccessibleName(/CHF\s*12\.50/);
    await firstShare.check();

    expect(planPostCount).toBe(1);
    expect(accountReadsAfterPlan).toBeGreaterThan(0);
    expect(paymentWrites).toEqual(['equal-share-plan']);
  } finally {
    releasePlanResponse();
  }
});

async function fulfillData(route: Route, data: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
}
