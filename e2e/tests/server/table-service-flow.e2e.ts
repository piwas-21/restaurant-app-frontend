import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import {
  expect,
  mergeTests,
  request,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
  type ViewportSize,
} from '@playwright/test';
import { test as cashierTest } from '../../fixtures/cashierUser';
import { test as serverTest } from '../../fixtures/serverUser';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { apiBaseUrl, frontendBaseUrl } from '../../helpers/config';
import { deleteUserByEmail, promoteE2EUser } from '../../helpers/db';
import { writeAuthStorageState } from '../../helpers/storageState';
import type { AccountPaymentAccount } from '../../../src/types/accountPaymentAccount';
import type { AccountPaymentOperation } from '../../../src/types/accountPayments';
import type { ServerFloorSnapshot } from '../../../src/types/serverWorkspace';
import {
  cleanupServerTableFixture,
  createServerTableFixture,
  type ServerTableFixture,
} from '../../seed/serverTableService';

interface KitchenStaffUser {
  storageStatePath: string;
}

interface AuthResponseData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accessToken: string;
  refreshToken: string;
}

const kitchenStaffTest = base.extend<{ kitchenStaffUser: KitchenStaffUser }>({
  kitchenStaffUser: async ({ baseURL }, expose, testInfo) => {
    const email = `e2e-kitchen-${testInfo.testId}-${randomUUID()}@test.local`;
    const password = `${randomUUID().replace(/-/g, '').split('').join('.')}.aA1!`;
    const api = await request.newContext({ baseURL: apiBaseUrl() });
    let storageStatePath: string | undefined;

    try {
      const registration = await api.post('/api/User/register/customer', {
        data: { firstName: 'E2E', lastName: 'Kitchen', email, password, confirmPassword: password },
      });
      const registrationBody = (await registration.json()) as ApiEnvelope<unknown>;
      if (!registration.ok() || registrationBody.success !== true) {
        const reason =
          registrationBody.errorCode ??
          registrationBody.errors?.join('; ') ??
          registrationBody.message ??
          'missing response detail';
        throw new Error(`Kitchen staff fixture registration failed (${registration.status()}): ${reason}`);
      }

      const promoted = await promoteE2EUser(email, 'KitchenStaff');
      if (promoted !== 1) throw new Error(`Kitchen staff fixture promotion updated ${promoted} rows.`);

      const login = await api.post('/api/Auth/login', { data: { email, password } });
      const loginBody = (await login.json()) as ApiEnvelope<AuthResponseData>;
      if (!login.ok() || loginBody.success !== true || !loginBody.data) {
        throw new Error(`Kitchen staff fixture login failed (${login.status()}).`);
      }
      const user = loginBody.data;
      if (user.role !== 'KitchenStaff') throw new Error('Kitchen staff fixture received the wrong role.');

      storageStatePath = await writeAuthStorageState({
        frontendOrigin: baseURL ?? frontendBaseUrl(),
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          accessToken: user.accessToken,
        },
        role: 'kitchen',
        slug: testInfo.testId,
      });

      await expose({ storageStatePath });
    } finally {
      await api.dispose();
      if (storageStatePath) await rm(storageStatePath, { force: true });
      try {
        await deleteUserByEmail(email);
      } catch (error) {
        console.warn(`[kitchenStaffUser] teardown failed for ${testInfo.testId}:`, error);
      }
    }
  },
});

const test = mergeTests(serverTest, cashierTest, kitchenStaffTest);
const PRODUCT = 'E2E Test Product';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  errors?: string[];
}

interface CreatedOrder {
  id: string;
  orderNumber: string;
}

interface TableReadinessOutcome {
  tableId: string;
  operationId: string;
  readinessState: string;
  readinessVersion: number;
}

interface UpdatedOrder {
  id: string;
  status: string;
  version: number;
}

interface KitchenBoardCompletion {
  orderId: string;
  workItemId: string;
  kind: string;
  accountRevision: number | null;
  acknowledgedOrderVersion: number;
  isCompleted: boolean;
}

interface OpenedSession {
  serviceSessionId: string;
  status: string;
}

interface ClosedSession {
  serviceSessionId: string;
  status: string;
}

const VIEWPORTS: readonly { name: string; viewport: ViewportSize }[] = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'tablet', viewport: { width: 1024, height: 768 } },
];

async function requireResponseData<T>(
  page: Page,
  path: RegExp,
  action: () => Promise<void>,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === method,
  );
  await action();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`${method} ${path} failed (${response.status()}): ${body.message ?? 'missing response data'}`);
  }
  return body.data;
}

async function requireAuthenticatedData<T>(token: string, path: string): Promise<T> {
  const api = await request.newContext({
    baseURL: apiBaseUrl(),
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const response = await api.get(path);
    const body = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok() || body.success !== true || body.data === undefined) {
      throw new Error(`GET ${path} failed (${response.status()}): ${body.message ?? 'missing response data'}`);
    }
    return body.data;
  } finally {
    await api.dispose();
  }
}

async function openServerContext(
  browser: Browser,
  storageState: string,
  viewport: ViewportSize,
  theme: 'light' | 'dark',
) {
  const context = await browser.newContext({
    storageState,
    viewport,
    baseURL: frontendBaseUrl(),
  });
  await context.addInitScript((selectedTheme) => {
    localStorage.setItem('rumiTheme', selectedTheme);
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  }, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  return { context, page };
}

for (const { name, viewport } of VIEWPORTS) {
  test(`server completes a table visit with kitchen work and cashier collection on ${name}`, async ({
    browser,
    serverUser,
    cashierUser,
    kitchenStaffUser,
  }) => {
    test.setTimeout(120_000);
    let table: ServerTableFixture | undefined;
    const contexts: BrowserContext[] = [];
    const theme: 'light' | 'dark' = name === 'phone' ? 'light' : 'dark';

    try {
      table = await createServerTableFixture();
      const server = await openServerContext(browser, serverUser.storageStatePath, viewport, theme);
      contexts.push(server.context);
      const cashier = await openServerContext(browser, cashierUser.storageStatePath, viewport, theme);
      contexts.push(cashier.context);
      const kitchen = await openServerContext(browser, kitchenStaffUser.storageStatePath, viewport, theme);
      contexts.push(kitchen.context);
      await server.page.goto('/en/server/floor');
      await server.page.getByTestId('server-floor-workspace').waitFor();
      await expect(server.page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(server.page.locator('footer')).toHaveCount(0);
      const floorViewport = await server.page.evaluate(() => ({
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(floorViewport.scrollHeight).toBeLessThanOrEqual(floorViewport.clientHeight + 2);
      await expectNoA11yViolations(server.page);
      await server.page.getByRole('button', { name: 'List', exact: true }).click();
      const floorCard = server.page.locator('article').filter({ hasText: table.tableNumber });
      await floorCard.getByRole('link', { name: /Open Table/i }).click();
      await server.page.getByRole('heading', { level: 1, name: table.tableNumber }).waitFor();

      const readiness = await requireResponseData<TableReadinessOutcome>(
        server.page,
        new RegExp(`^/api/Tables/${table.tableId}/ready$`),
        async () => {
          await server.page.getByRole('button', { name: 'Ready for next guests', exact: true }).click();
        },
      );
      expect(readiness).toMatchObject({ tableId: table.tableId, readinessState: 'ReadyForGuests' });
      expect(readiness.operationId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(readiness.readinessVersion).toBeGreaterThan(0);
      await expect(server.page.getByRole('button', { name: /Open Table/ })).toBeEnabled();

      const opened = await requireResponseData<OpenedSession>(
        server.page,
        /^\/api\/table-service-sessions$/,
        async () => {
          await server.page.getByRole('button', { name: 'Open Table' }).click();
        },
      );
      expect(opened.status).toBe('Open');
      const addRound = server.page.getByRole('link', { name: 'Add round' });
      await addRound.waitFor();
      await addRound.click();

      await server.page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true }).click();
      await server.page.getByRole('region', { name: 'Next round' }).getByText(PRODUCT, { exact: true }).waitFor();
      const created = await requireResponseData<CreatedOrder>(
        server.page,
        /^\/api\/staff\/orders\/round$/,
        async () => {
          await server.page.getByRole('button', { name: 'Send to kitchen' }).click();
        },
      );
      await server.page.getByText(`Round ${created.orderNumber} was created.`).waitFor();
      await expectNoA11yViolations(server.page);

      await kitchen.page.goto('/en/kitchen-staff');
      await kitchen.page.getByRole('tab', { name: 'Kitchen work', exact: true }).waitFor();
      const kitchenOrder = kitchen.page.getByRole('article').filter({ hasText: created.orderNumber });
      await kitchenOrder.waitFor({ timeout: 20_000 });
      await expect(kitchenOrder).toContainText('No printer configured');
      await expectNoA11yViolations(kitchen.page);

      const preparing = await requireResponseData<UpdatedOrder>(
        kitchen.page,
        new RegExp(`^/api/Orders/${created.id}/status$`),
        async () => {
          await kitchenOrder.getByRole('button', { name: 'Start preparing', exact: true }).click();
        },
        'PUT',
      );
      expect(preparing).toMatchObject({ id: created.id, status: 'Preparing' });
      expect(preparing.version).toBeGreaterThan(0);

      const ready = await requireResponseData<UpdatedOrder>(
        kitchen.page,
        new RegExp(`^/api/Orders/${created.id}/status$`),
        async () => {
          await kitchenOrder.getByRole('button', { name: 'Mark ready', exact: true }).click();
        },
        'PUT',
      );
      expect(ready).toMatchObject({ id: created.id, status: 'Ready' });
      expect(ready.version).toBeGreaterThan(preparing.version);

      const completion = await requireResponseData<KitchenBoardCompletion>(
        kitchen.page,
        new RegExp(`^/api/staff/kitchen-board/orders/${created.id}/work-items/${created.id}/complete$`),
        async () => {
          await kitchenOrder.getByRole('button', { name: 'Acknowledge completed work', exact: true }).click();
        },
      );
      expect(completion).toMatchObject({
        orderId: created.id,
        workItemId: created.id,
        kind: 'InitialOrder',
        accountRevision: null,
        isCompleted: true,
      });
      expect(completion.acknowledgedOrderVersion).toBe(ready.version);
      await expect(kitchenOrder).toContainText('Work complete');

      await server.page.goto('/en/server/tasks');
      await server.page.getByRole('tab', { name: /Exception/ }).click();
      const task = server.page.getByTestId(`server-task-${created.id}`);
      await task.waitFor({ timeout: 20_000 });
      await expectNoA11yViolations(server.page);
      await expect(task).toHaveAttribute('data-bucket', 'Exception');
      const deliver = task.getByRole('button', { name: `Deliver ${created.orderNumber}` });
      await expect(deliver).toBeEnabled();
      await deliver.click();
      await server.page.getByText('Task updated.').waitFor();

      await cashier.page.goto('/en/cashier/tables');
      await cashier.page.getByRole('button', { name: 'List' }).click();
      await cashier.page.getByRole('button', { name: new RegExp(`Open table .*${table.tableNumber}`) }).click();
      await cashier.page.getByRole('heading', { level: 2, name: table.tableNumber }).waitFor();
      await expect(cashier.page.locator('html')).toHaveAttribute('data-theme', theme);
      await cashier.page.getByRole('link', { name: 'Collect payment', exact: true }).hover();
      await expectNoA11yViolations(cashier.page);
      await cashier.page.getByRole('link', { name: 'Collect payment', exact: true }).click();
      const collection = cashier.page.getByRole('region', { name: 'Collect a contribution', exact: true });
      await expect(collection).toBeVisible();
      await expectNoA11yViolations(cashier.page);
      const form = collection.locator('form');
      await expect(form.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();

      const accountPath = `/api/table-service-sessions/${opened.serviceSessionId}/account-payments`;
      const account = await requireAuthenticatedData<AccountPaymentAccount>(cashierUser.accessToken, accountPath);
      expect(account).toMatchObject({ serviceSessionId: opened.serviceSessionId, currency: 'CHF' });
      expect(account.outstandingMinor).toBeGreaterThan(0);
      const reserveResponsePromise = cashier.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new RegExp(`^${accountPath}/operations/[^/]+/reserve$`, 'i').test(new URL(response.url()).pathname),
      );
      const quote = await requireResponseData<AccountPaymentOperation>(
        cashier.page,
        new RegExp(`^${accountPath}/quotes$`),
        async () => {
          await form.getByRole('button', { name: 'Review contribution', exact: true }).click();
        },
      );
      const reserveResponse = await reserveResponsePromise;
      const reserveBody = (await reserveResponse.json()) as ApiEnvelope<AccountPaymentOperation>;
      if (!reserveResponse.ok() || reserveBody.success !== true || !reserveBody.data) {
        throw new Error(`Automatic account reservation failed with HTTP ${reserveResponse.status()}.`);
      }
      expect(new URL(reserveResponse.url()).pathname.toLowerCase()).toBe(
        `${accountPath}/operations/${quote.operationId}/reserve`.toLowerCase(),
      );
      expect(reserveResponse.request().postDataJSON()).toMatchObject({
        expectedVersion: quote.version,
        expectedAccountRevision: quote.expectedAccountRevision,
      });
      const reserve = reserveBody.data;
      expect(quote).toMatchObject({
        serviceSessionId: opened.serviceSessionId,
        mode: 'Full',
        paymentMethod: 'Cash',
        state: 'Quoted',
        amountMinor: account.availableMinor,
        tipMinor: 0,
      });
      expect(reserve.state).toBe('Reserved');
      const dueMinor = reserve.cashSettlement?.dueAmountMinor;
      expect(dueMinor).toBeGreaterThan(0);
      await cashier.page.getByLabel('Cash received', { exact: true }).fill(((dueMinor ?? 0) / 100).toFixed(2));
      await expect(cashier.page.getByRole('button', { name: 'Record cash received', exact: true })).toBeEnabled();
      const captured = await requireResponseData<AccountPaymentOperation>(
        cashier.page,
        new RegExp(`^${accountPath}/operations/${quote.operationId}/collect$`),
        async () => {
          await cashier.page.getByRole('button', { name: 'Record cash received', exact: true }).click();
        },
      );
      expect(captured).toMatchObject({
        serviceSessionId: opened.serviceSessionId,
        operationId: quote.operationId,
        state: 'Captured',
        paymentMethod: 'Cash',
        amountMinor: account.availableMinor,
        tipMinor: 0,
        cashReceipt: { receivedMinor: dueMinor, changeMinor: 0 },
      });

      const accountReadback = await requireAuthenticatedData<AccountPaymentAccount>(
        cashierUser.accessToken,
        accountPath,
      );
      expect(accountReadback).toMatchObject({
        serviceSessionId: opened.serviceSessionId,
        outstandingMinor: 0,
        availableMinor: 0,
        capturedAccountPaymentMinor: account.availableMinor,
      });
      const receiptReadback = await requireAuthenticatedData<AccountPaymentOperation>(
        cashierUser.accessToken,
        `${accountPath}/operations/${quote.operationId}`,
      );
      expect(receiptReadback).toMatchObject({
        operationId: quote.operationId,
        state: 'Captured',
        amountMinor: account.availableMinor,
        tipMinor: 0,
        cashReceipt: { receivedMinor: dueMinor, changeMinor: 0 },
      });

      await server.page.goto(`/en/server/tables/${table.tableId}?serviceSessionId=${opened.serviceSessionId}`);
      await server.page.getByRole('button', { name: 'Refresh', exact: true }).click();
      const closeVisit = server.page.getByRole('button', { name: 'Close visit' }).first();
      await closeVisit.waitFor();
      await closeVisit.click();
      const modal = server.page.getByRole('dialog');
      const closed = await requireResponseData<ClosedSession>(
        server.page,
        new RegExp(`^/api/table-service-sessions/${opened.serviceSessionId}/close$`),
        async () => {
          await modal.getByRole('button', { name: 'Close visit' }).click();
        },
      );
      expect(closed).toMatchObject({ serviceSessionId: opened.serviceSessionId, status: 'Closed' });
      await server.page.goto('/en/server/floor');
      await server.page.getByTestId('server-floor-workspace').waitFor();
      const floorAfterClose = await requireAuthenticatedData<ServerFloorSnapshot>(
        serverUser.accessToken,
        '/api/staff/server-workspace/floor',
      );
      const closedTableId = table.tableId;
      const physicalTableAfterClose = floorAfterClose.tables.find((entry) => entry.tableId === closedTableId);
      expect(physicalTableAfterClose).toMatchObject({ state: 'NeedsReset', readinessState: 'NeedsReset' });
      await server.page.getByRole('button', { name: 'List', exact: true }).click();
      const nextVisitCard = server.page.locator('article').filter({ hasText: table.tableNumber });
      await nextVisitCard.getByRole('link', { name: /Open Table/i }).click();
      await server.page.getByRole('heading', { level: 1, name: table.tableNumber }).waitFor();
      const nextReadiness = await requireResponseData<TableReadinessOutcome>(
        server.page,
        new RegExp(`^/api/Tables/${table.tableId}/ready$`),
        async () => {
          await server.page.getByRole('button', { name: 'Ready for next guests', exact: true }).click();
        },
      );
      expect(nextReadiness).toMatchObject({ tableId: table.tableId, readinessState: 'ReadyForGuests' });
      expect(nextReadiness.readinessVersion).toBeGreaterThan(readiness.readinessVersion);
      await expect(server.page.getByRole('button', { name: 'Open Table' })).toBeEnabled();
      await expectNoA11yViolations(server.page);
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
      if (table) await cleanupServerTableFixture(table.tableId);
    }
  });
}
