import {
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { test as p11Test, type P11StaffUser } from '../staffUsers';
import { createTableAccountP11Fixture, type TableAccountP11Fixture } from '../../seed/tableAccountP11';
import { openMenuBasket, proceedViaSidebarExpectingNavigation } from '../../helpers/menuBasket';

const PRODUCT = 'E2E Test Product';
const EXPECTED_SERVER_ROUNDS = 4;

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
}

interface OpenSession {
  readonly serviceSessionId: string;
  readonly status: string;
}

interface CreatedRound {
  readonly id: string;
  readonly orderNumber: string;
  readonly serviceSessionId: string;
}

interface GuestAccount {
  readonly serviceSessionId: string;
}

interface CommittedAmendment {
  readonly amendmentId: string;
  readonly sourceOrderId: string;
}

interface PrinterChange {
  readonly kind: string;
}

interface PrinterUpdate {
  readonly jobType: string;
  readonly audience: string;
  readonly orderId: string;
  readonly serviceSessionId: string | null;
  readonly amendmentId: string | null;
  readonly changes: readonly PrinterChange[];
}

interface PrinterFeed {
  readonly updates: readonly PrinterUpdate[];
}

interface SessionOrderSnapshot {
  readonly id: string;
  readonly serviceSessionId: string | null;
  readonly status: string;
  readonly isKitchenReleased: boolean;
  readonly version: number;
}

interface PagedOrders {
  readonly items: readonly SessionOrderSnapshot[];
}

async function openStaffContext(browser: Browser, baseURL: string | undefined, user: P11StaffUser) {
  if (!baseURL) throw new Error('The isolated P11 UI origin is unavailable.');
  const context = await browser.newContext({ storageState: user.storageStatePath, baseURL });
  await context.addInitScript(() => {
    window.localStorage.setItem('i18nextLng', 'en');
    window.localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  return { context, page };
}

async function openGuestContext(browser: Browser, baseURL: string | undefined) {
  if (!baseURL) throw new Error('The isolated P11 UI origin is unavailable.');
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => {
    window.localStorage.setItem('i18nextLng', 'en');
    window.localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  return { context, page };
}

async function requirePostData<T>(page: Page, path: RegExp, action: () => Promise<unknown>): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
  );
  await action();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`P11 request ${path} was refused with HTTP ${response.status()}.`);
  }
  return body.data;
}

function chfAmountPattern(amount: string): RegExp {
  if (!/^\d+\.\d{2}$/.test(amount)) {
    throw new Error(`P11 expected amount ${amount} must use two decimal places.`);
  }
  const [whole, fraction] = amount.split('.');
  return new RegExp(`^(?:CHF\\s*${whole}[.,]${fraction}|${whole}[.,]${fraction}\\s*CHF)$`);
}

async function expectChfAmount(scope: Locator, label: string, amount: string): Promise<void> {
  const value = scope.getByText(label, { exact: true }).locator('xpath=following-sibling::dd[1]');
  await expect(value).toBeVisible();
  const rendered = (await value.innerText())
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  expect(rendered).toMatch(chfAmountPattern(amount));
}

async function admissionCode(page: Page): Promise<string> {
  const panel = page.getByRole('region', { name: 'Guest visit code' });
  await panel.getByRole('button', { name: 'Generate new visit code', exact: true }).click();
  const code = await panel.locator('code').innerText();
  if (!/^[A-Z0-9]{10}$/.test(code)) throw new Error('P11 received an invalid guest admission-code shape.');
  return code;
}

async function markTableReady(page: Page, tableId: string): Promise<void> {
  const readinessResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/Tables/${tableId}/ready` && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ready for next guests', exact: true }).click();
  const response = await readinessResponse;
  if (!response.ok()) throw new Error(`P11 table readiness was refused with HTTP ${response.status()}.`);
  await page.reload();
}

async function resolveServiceSessionOrders(
  apiOrigin: string,
  adminAccessToken: string,
  tableNumber: string,
  serviceSessionId: string,
  expectedOrderCount: number,
): Promise<void> {
  const api: APIRequestContext = await request.newContext({
    baseURL: apiOrigin,
    extraHTTPHeaders: { Authorization: `Bearer ${adminAccessToken}` },
  });

  try {
    const response = await api.get('/api/orders', {
      params: { tableNumber, page: 1, pageSize: 100 },
    });
    const body = (await response.json()) as ApiEnvelope<PagedOrders>;
    if (!response.ok() || body.success !== true || !body.data) {
      throw new Error(`P11 could not inspect service-session orders (HTTP ${response.status()}).`);
    }

    const sessionOrders = body.data.items.filter(
      (order) => order.serviceSessionId?.toLowerCase() === serviceSessionId.toLowerCase(),
    );
    if (sessionOrders.length !== expectedOrderCount) {
      throw new Error(`P11 found ${sessionOrders.length} visit orders; expected ${expectedOrderCount} before close.`);
    }

    for (const order of sessionOrders) {
      if (!order.isKitchenReleased) {
        throw new Error(`P11 order ${order.id} is still held and cannot be advanced through service.`);
      }

      const remainingStatuses = statusesToComplete(order.status);
      let currentVersion = order.version;
      for (const newStatus of remainingStatuses) {
        const update = await api.put(`/api/orders/${encodeURIComponent(order.id)}/status`, {
          data: { newStatus, expectedVersion: currentVersion },
        });
        const updateBody = (await update.json()) as ApiEnvelope<SessionOrderSnapshot>;
        if (!update.ok() || updateBody.success !== true || !updateBody.data) {
          throw new Error(`P11 order ${order.id} could not transition to ${newStatus} (HTTP ${update.status()}).`);
        }
        if (updateBody.data.status !== newStatus) {
          throw new Error(`P11 order ${order.id} returned an unexpected status after ${newStatus}.`);
        }
        currentVersion = updateBody.data.version;
      }
    }
  } finally {
    await api.dispose();
  }
}

function statusesToComplete(currentStatus: string): readonly string[] {
  switch (currentStatus) {
    case 'Confirmed':
      return ['Preparing', 'Ready', 'Completed'];
    case 'Preparing':
      return ['Ready', 'Completed'];
    case 'Ready':
      return ['Completed'];
    case 'Completed':
      return [];
    default:
      throw new Error(`P11 cannot safely resolve an order in ${currentStatus} for visit closure.`);
  }
}

async function addServerRound(page: Page, table: TableAccountP11Fixture, sessionId: string): Promise<CreatedRound> {
  await page.goto(
    `/en/server/tables/${encodeURIComponent(table.tableId)}/order?serviceSessionId=${encodeURIComponent(sessionId)}`,
  );
  await expect(page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true }).click();
  return requirePostData<CreatedRound>(page, /^\/api\/staff\/orders\/round$/, () =>
    page.getByRole('button', { name: 'Send to kitchen', exact: true }).click(),
  );
}

p11Test('CHF amount matching accepts exact values and rejects near-matches', () => {
  const pattern = chfAmountPattern('60.00');
  expect(pattern.test('CHF 60.00')).toBe(true);
  expect(pattern.test('60.00 CHF')).toBe(true);
  expect(pattern.test('CHF 0.00')).toBe(false);
  expect(chfAmountPattern('0.00').test('60.00 CHF')).toBe(false);
  expect(pattern.test('160.00 CHF')).toBe(false);
  expect(pattern.test('CHF 60.00 trailing')).toBe(false);
});

p11Test(
  'one visit carries guest and staff rounds, a kitchen delta, cash evidence, and renewal guards',
  async ({ browser, baseURL, p11Admin, p11Cashier, p11Server }) => {
    p11Test.setTimeout(15 * 60 * 1000);
    const contexts: BrowserContext[] = [];
    let table: TableAccountP11Fixture | undefined;
    let printer: Awaited<ReturnType<typeof request.newContext>> | undefined;

    try {
      table = await createTableAccountP11Fixture(p11Admin.accessToken);
      const apiOrigin = process.env.E2E_API_BASE_URL;
      const printerKey = process.env.P11_PRINTER_API_KEY;
      if (!apiOrigin || !printerKey) throw new Error('The guarded local printer-feed identity is unavailable.');
      printer = await request.newContext({ baseURL: apiOrigin, extraHTTPHeaders: { 'X-Api-Key': printerKey } });

      const server = await openStaffContext(browser, baseURL, p11Server);
      contexts.push(server.context);
      const firstGuest = await openGuestContext(browser, baseURL);
      contexts.push(firstGuest.context);

      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await markTableReady(server.page, table.tableId);
      const firstSession = await requirePostData<OpenSession>(server.page, /^\/api\/table-service-sessions$/, () =>
        server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      expect(firstSession.status).toBe('Open');
      const oldVisitCode = await admissionCode(server.page);
      await firstGuest.page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
      await expect(firstGuest.page.getByRole('heading', { name: 'Join this table visit' })).toBeVisible();
      await firstGuest.page.getByLabel('Table visit code').fill(oldVisitCode);
      await firstGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      await expect(firstGuest.page).toHaveURL(/\/en\/menu$/);

      await firstGuest.page.goto('/en/table-account');
      await expect(firstGuest.page.getByRole('heading', { name: 'Table account', exact: true })).toBeVisible();
      await server.page.getByRole('button', { name: 'Close visit', exact: true }).click();
      const closeDialog = server.page.getByRole('dialog');
      const closedSession = await requirePostData<OpenSession>(
        server.page,
        new RegExp(`^/api/table-service-sessions/${firstSession.serviceSessionId}/close$`),
        () => closeDialog.getByRole('button', { name: 'Close visit', exact: true }).click(),
      );
      expect(closedSession.status).toBe('Closed');
      await firstGuest.page.getByRole('button', { name: 'Refresh account', exact: true }).click();
      // Closed-account reads use the public non-enumerating unavailable response (404).
      // The new visit's admission-code check below separately proves the old code is rejected.
      await expect(firstGuest.page.getByRole('heading', { name: 'Table account unavailable' })).toBeVisible();

      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await markTableReady(server.page, table.tableId);

      const secondSession = await requirePostData<OpenSession>(server.page, /^\/api\/table-service-sessions$/, () =>
        server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      expect(secondSession.status).toBe('Open');
      expect(secondSession.serviceSessionId).not.toBe(firstSession.serviceSessionId);
      const currentVisitCode = await admissionCode(server.page);

      const currentGuest = await openGuestContext(browser, baseURL);
      contexts.push(currentGuest.context);
      await currentGuest.page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
      await expect(currentGuest.page.getByRole('heading', { name: 'Join this table visit' })).toBeVisible();
      await currentGuest.page.getByLabel('Table visit code').fill(oldVisitCode);
      await currentGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      const firstStaleVisitError = currentGuest.page
        .getByRole('alert')
        .filter({ hasText: 'We could not join this visit' });
      await expect(firstStaleVisitError).toHaveCount(1);
      await expect(firstStaleVisitError).toContainText('We could not join this visit');
      await currentGuest.page.getByLabel('Table visit code').fill(currentVisitCode);
      await currentGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      await expect(currentGuest.page).toHaveURL(/\/en\/menu$/);

      const basketResponse = currentGuest.page.waitForResponse(
        (response) =>
          /\/api\/Basket(?:\/|$)/i.test(new URL(response.url()).pathname) &&
          ['POST', 'PUT'].includes(response.request().method()),
      );
      await currentGuest.page
        .getByTestId('menu-card')
        .filter({ hasText: PRODUCT })
        .getByRole('button', { name: `Add ${PRODUCT} to order`, exact: true })
        .click();
      await basketResponse;
      const basket = await openMenuBasket(currentGuest.page);
      await proceedViaSidebarExpectingNavigation(currentGuest.page, basket);
      await expect(currentGuest.page.getByRole('heading', { name: 'Review this table round' })).toBeVisible();
      const guestAccount = await requirePostData<GuestAccount>(
        currentGuest.page,
        new RegExp(`^/api/table-guest-visits/${secondSession.serviceSessionId}/rounds$`),
        () => currentGuest.page.getByRole('button', { name: 'Add this round', exact: true }).click(),
      );
      expect(guestAccount.serviceSessionId.toLowerCase()).toBe(secondSession.serviceSessionId.toLowerCase());
      await expect(currentGuest.page.getByText('Your round was added to this table account.')).toBeVisible();

      const serverRounds: CreatedRound[] = [];
      for (let index = 0; index < EXPECTED_SERVER_ROUNDS; index += 1) {
        const round = await addServerRound(server.page, table, secondSession.serviceSessionId);
        expect(round.serviceSessionId.toLowerCase()).toBe(secondSession.serviceSessionId.toLowerCase());
        serverRounds.push(round);
      }
      expect(serverRounds).toHaveLength(EXPECTED_SERVER_ROUNDS);
      expect(new Set(serverRounds.map((round) => round.id)).size).toBe(EXPECTED_SERVER_ROUNDS);

      const amendedRound = serverRounds.at(-1);
      if (!amendedRound) throw new Error('P11 did not create a server round to correct.');
      await server.page.goto(`/en/server/orders/${encodeURIComponent(amendedRound.id)}`);
      await server.page.getByRole('button', { name: 'Amend order', exact: true }).click();
      const amendmentDialog = server.page.getByRole('dialog');
      await amendmentDialog.getByRole('combobox', { name: 'Change this line' }).selectOption('Void');
      await amendmentDialog.getByLabel('Reason for this change').fill('Guest requested removal before service.');
      await requirePostData(server.page, new RegExp(`^/api/staff/orders/${amendedRound.id}/amendments/quote$`), () =>
        amendmentDialog.getByRole('button', { name: 'Get a quote', exact: true }).click(),
      );
      const historyRead = server.page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === `/api/staff/orders/${amendedRound.id}/amendments`,
      );
      const committed = await requirePostData<CommittedAmendment>(
        server.page,
        new RegExp(`^/api/staff/orders/${amendedRound.id}/amendments/commit$`),
        () => amendmentDialog.getByRole('button', { name: 'Confirm amendment', exact: true }).click(),
      );
      expect(committed.sourceOrderId.toLowerCase()).toBe(amendedRound.id.toLowerCase());
      expect(committed.amendmentId).toMatch(/^[0-9a-f-]{36}$/i);
      const historyResponse = await historyRead;
      const historyBody = (await historyResponse.json()) as ApiEnvelope<
        readonly { amendmentId: string; sourceOrderId: string; state: string; changes: readonly { kind: string }[] }[]
      >;
      expect(historyResponse.ok()).toBe(true);
      expect(historyBody.success).toBe(true);
      const committedHistory = historyBody.data?.filter(
        (record) => record.amendmentId.toLowerCase() === committed.amendmentId.toLowerCase(),
      );
      expect(committedHistory).toHaveLength(1);
      expect(committedHistory?.[0]).toMatchObject({
        sourceOrderId: amendedRound.id,
        state: 'Committed',
        changes: [expect.objectContaining({ kind: 'Void' })],
      });
      await expect(amendmentDialog).toHaveCount(1);
      await expect(amendmentDialog.getByText(/^Amendment committed/)).toBeVisible();
      const footerClose = amendmentDialog
        .getByRole('button', { name: 'Close', exact: true })
        .filter({ hasText: /^Close$/ });
      await expect(footerClose).toHaveCount(1);
      await expect(footerClose).toBeVisible();
      await footerClose.click();
      await expect(amendmentDialog).toHaveCount(0);
      const history = server.page.getByRole('region', { name: 'Amendment history', exact: true });
      await history.locator('summary').click();
      await expect(history.getByText('Committed', { exact: true })).toBeVisible();
      await expect(history.getByText(/^Remove · E2E Test Product · /)).toBeVisible();

      const feedResponse = await printer.get('/api/orders/printer-feed');
      const feedBody = (await feedResponse.json()) as ApiEnvelope<PrinterFeed>;
      if (!feedResponse.ok() || feedBody.success !== true || !feedBody.data) {
        throw new Error(`P11 printer-feed evidence was unavailable with HTTP ${feedResponse.status()}.`);
      }
      const delta = feedBody.data.updates.find(
        (update) =>
          update.orderId.toLowerCase() === amendedRound.id.toLowerCase() &&
          update.serviceSessionId?.toLowerCase() === secondSession.serviceSessionId.toLowerCase() &&
          update.amendmentId?.toLowerCase() === committed.amendmentId.toLowerCase(),
      );
      expect(delta).toBeDefined();
      expect(delta).toMatchObject({ jobType: 'Update', audience: 'Kitchen' });
      expect(delta?.changes.some((change) => change.kind === 'Void')).toBe(true);

      const cashier = await openStaffContext(browser, baseURL, p11Cashier);
      contexts.push(cashier.context);
      await cashier.page.goto(`/en/cashier/tables?session=${encodeURIComponent(secondSession.serviceSessionId)}`);
      const collection = cashier.page.getByRole('region', { name: 'Collect a contribution' });
      await expect(collection).toBeVisible();
      await collection.getByRole('button', { name: 'Review contribution', exact: true }).click();
      const review = cashier.page.getByRole('region', { name: 'Review contribution' });
      await expect(review.getByRole('button', { name: 'Confirm reviewed contribution', exact: true })).toBeVisible();
      await review.getByRole('button', { name: 'Confirm reviewed contribution', exact: true }).click();
      await expect(review.getByRole('button', { name: 'Exact', exact: true })).toBeVisible();
      await review.getByRole('button', { name: 'Exact', exact: true }).click();
      await review
        .getByLabel('I have received this cash or confirmed this card payment on the separate terminal.')
        .check();
      await review.getByRole('button', { name: 'Record confirmed payment', exact: true }).click();
      await expect(review.getByRole('heading', { name: 'Recorded cash receipt' })).toBeVisible();
      await expectChfAmount(review, 'Exact account charge', '60.00');
      await expectChfAmount(review, 'Cash rounding adjustment', '0.00');
      await expectChfAmount(review, 'Cash due', '60.00');
      const receipt = review.getByRole('heading', { name: 'Recorded cash receipt' }).locator('xpath=..');
      await expectChfAmount(receipt, 'Cash received', '60.00');
      await expectChfAmount(receipt, 'Change', '0.00');

      await cashier.page.reload();
      const accountBalance = cashier.page.locator('dl[aria-label="Account balance"]');
      await expectChfAmount(accountBalance, 'Bill total', '60.00');
      await expectChfAmount(accountBalance, 'Captured', '60.00');
      await expectChfAmount(accountBalance, 'Outstanding', '0.00');

      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      const closeVisit = server.page.getByRole('button', { name: 'Close visit', exact: true });
      await expect(closeVisit).toBeDisabled();
      await expect(
        server.page.getByText('Every round must be completed or cancelled before closing.', {
          exact: true,
        }),
      ).toBeVisible();
      await resolveServiceSessionOrders(
        apiOrigin,
        p11Admin.accessToken,
        table.tableNumber,
        secondSession.serviceSessionId,
        EXPECTED_SERVER_ROUNDS + 1,
      );
      await server.page.reload();
      await expect(server.page.getByRole('button', { name: 'Close visit', exact: true })).toBeEnabled();
      await server.page.getByRole('button', { name: 'Close visit', exact: true }).click();
      const paidVisitDialog = server.page.getByRole('dialog');
      const closedPaidVisit = await requirePostData<OpenSession>(
        server.page,
        new RegExp(`^/api/table-service-sessions/${secondSession.serviceSessionId}/close$`),
        () => paidVisitDialog.getByRole('button', { name: 'Close visit', exact: true }).click(),
      );
      expect(closedPaidVisit.status).toBe('Closed');
      await currentGuest.page.goto('/en/table-account');
      await expect(currentGuest.page.getByRole('heading', { name: 'Table account unavailable' })).toBeVisible();

      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await markTableReady(server.page, table.tableId);
      const thirdSession = await requirePostData<OpenSession>(server.page, /^\/api\/table-service-sessions$/, () =>
        server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      expect(thirdSession.status).toBe('Open');
      expect(thirdSession.serviceSessionId.toLowerCase()).not.toBe(secondSession.serviceSessionId.toLowerCase());
      expect(thirdSession.serviceSessionId.toLowerCase()).not.toBe(firstSession.serviceSessionId.toLowerCase());
      const thirdVisitCode = await admissionCode(server.page);

      const thirdGuest = await openGuestContext(browser, baseURL);
      contexts.push(thirdGuest.context);
      await thirdGuest.page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
      await expect(thirdGuest.page.getByRole('heading', { name: 'Join this table visit' })).toBeVisible();
      await thirdGuest.page.getByLabel('Table visit code').fill(currentVisitCode);
      await thirdGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      const secondStaleVisitError = thirdGuest.page
        .getByRole('alert')
        .filter({ hasText: 'We could not join this visit' });
      await expect(secondStaleVisitError).toHaveCount(1);
      await expect(secondStaleVisitError).toContainText('We could not join this visit');
      await thirdGuest.page.getByLabel('Table visit code').fill(thirdVisitCode);
      await thirdGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      await expect(thirdGuest.page).toHaveURL(/\/en\/menu$/);

      await thirdGuest.page.goto('/en/table-account');
      await expect(thirdGuest.page.getByRole('heading', { name: 'Table account', exact: true })).toBeVisible();
      const emptyAccount = thirdGuest.page.locator('dl[aria-label="Table account totals"]');
      await expectChfAmount(emptyAccount, 'Total', '0.00');
      await expectChfAmount(emptyAccount, 'Paid so far', '0.00');
      await expectChfAmount(emptyAccount, 'Remaining with staff', '0.00');
      await expect(
        thirdGuest.page.getByText('No rounds have been sent for this visit yet.', { exact: true }),
      ).toBeVisible();
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
      await printer?.dispose();
      // This journey intentionally retains its table, visits, orders, amendment, and payment rows.
      // The local runner snapshots the run-owned database before removing only its own volume.
    }
  },
);
