import {
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { getE2EDbPool } from '../../helpers/db';
import { test as p11Test, type P11StaffUser } from '../staffUsers';
import { createTableAccountP11Fixture, type TableAccountP11Fixture } from '../../seed/tableAccountP11';
import {
  acknowledgeCorrectionWork,
  readNativeKitchenSnapshot,
  readServerTask,
  addGuestBasketRound,
  assertOrderAmendmentsSettled,
  cancelFullyCreditedUnpaidOrder,
  resolveUnpaidAmendmentCredit,
  type NativeKitchenSnapshot,
  type ServerTask,
} from '../helpers/nativeKitchenAcceptance';

const PRODUCT = 'E2E Test Product';
const PARTIAL_REMOVAL_REASON = 'Guest requested one unit removed before service.';
const FULL_REMOVAL_REASON = 'Guest cancelled the remaining unit before collection.';
const NO_PRINTER = 'No printer configured';
const BASE_HANDOVER_BLOCK = 'Acknowledge the kitchen work before handover.';
const CORRECTION_HANDOVER_BLOCK = 'Acknowledge the kitchen correction before handover.';
const CORRECTION_CLOSE_BLOCK = 'Acknowledge the kitchen correction before closing this visit.';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errorCode?: string;
}

interface P11Response {
  json(): Promise<unknown>;
  ok(): boolean;
  status(): number;
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

interface CommittedAmendment {
  readonly amendmentId: string;
  readonly sourceOrderId: string;
}

interface StoredCompletion {
  readonly order_id: string;
  readonly work_item_id: string;
  readonly kind: string;
  readonly account_revision: string | null;
  readonly acknowledged_order_version: number;
}

interface StoredRoute {
  readonly status: string;
  readonly device_id: string | null;
}

async function openStaffContext(browser: Browser, baseURL: string | undefined, user: P11StaffUser) {
  if (!baseURL) throw new Error('The isolated P11 UI origin is unavailable.');
  const context = await browser.newContext({ storageState: user.storageStatePath, baseURL });
  await context.addInitScript(() => {
    window.localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  return { context, page };
}

async function openGuestContext(browser: Browser, baseURL: string | undefined) {
  if (!baseURL) throw new Error('The isolated P11 UI origin is unavailable.');
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => {
    window.localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  return { context, page };
}

async function requireApiData<T>(response: P11Response, label: string): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`P11 ${label} was refused with HTTP ${response.status()}.`);
  }
  return body.data;
}

async function requirePostData<T>(page: Page, path: RegExp, action: () => Promise<unknown>): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
  );
  await action();
  const response = await responsePromise;
  return requireApiData<T>(response, 'staff workflow');
}

async function markTableReady(page: Page, tableId: string): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/Tables/${tableId}/ready` && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ready for next guests', exact: true }).click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`P11 table readiness was refused with HTTP ${response.status()}.`);
  await page.reload();
}

async function admissionCode(page: Page): Promise<string> {
  const panel = page.getByRole('region', { name: 'Guest visit code' });
  await panel.getByRole('button', { name: 'Generate new visit code', exact: true }).click();
  const code = await panel.locator('code').innerText();
  if (!/^[A-Z0-9]{10}$/.test(code)) throw new Error('P11 received an invalid guest admission-code shape.');
  return code;
}

async function addRound(
  page: Page,
  table: TableAccountP11Fixture,
  sessionId: string,
  quantity: number,
): Promise<CreatedRound> {
  await page.goto(
    `/en/server/tables/${encodeURIComponent(table.tableId)}/order?serviceSessionId=${encodeURIComponent(sessionId)}`,
  );
  const addProduct = page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true });
  await expect(addProduct).toBeVisible();
  await addProduct.click();
  if (quantity > 1) {
    const quantityInput = page.getByRole('spinbutton', { name: `Quantity ${PRODUCT}`, exact: true });
    await quantityInput.fill(String(quantity));
    await expect(quantityInput).toHaveValue(String(quantity));
  }
  const round = await requirePostData<CreatedRound & { readonly status: string; readonly isKitchenReleased: boolean }>(
    page,
    /^\/api\/staff\/orders\/round$/,
    () => page.getByRole('button', { name: 'Send to kitchen', exact: true }).click(),
  );
  expect(round.serviceSessionId.toLowerCase()).toBe(sessionId.toLowerCase());
  expect(round.status).toBe('Confirmed');
  expect(round.isKitchenReleased).toBe(true);
  return round;
}

function orderCard(board: Page, order: CreatedRound): Locator {
  return board
    .getByRole('article')
    .filter({ has: board.getByRole('heading', { name: `Order ${order.orderNumber}`, exact: true }) });
}

function correctionCard(board: Page, orderNumber: string): Locator {
  return board
    .getByRole('article')
    .filter({ has: board.getByRole('heading', { name: `Correction for order ${orderNumber}`, exact: true }) });
}

async function refreshBoard(board: Page): Promise<void> {
  const native = board.getByRole('region', { name: 'Kitchen workspaces' });
  await native.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(board.getByRole('heading', { name: 'Kitchen work', exact: true })).toBeVisible();
}

async function setReadyOnBoard(board: Page, round: CreatedRound): Promise<void> {
  const card = orderCard(board, round);
  await expect(card).toBeVisible();
  await expect(card).toContainText(NO_PRINTER);
  const startPreparing = card.getByRole('button', { name: 'Start preparing', exact: true });
  await expect(startPreparing).toBeVisible();
  await expect(startPreparing).toBeEnabled();
  await startPreparing.click();
  const markReady = card.getByRole('button', { name: 'Mark ready', exact: true });
  await expect(markReady).toBeVisible();
  await expect(markReady).toBeEnabled();
  await markReady.click();
  const acknowledge = card.getByRole('button', { name: 'Acknowledge completed work', exact: true });
  await expect(acknowledge).toBeVisible();
  await expect(acknowledge).toBeEnabled();
}

async function acknowledgeInitialWork(board: Page, round: CreatedRound): Promise<void> {
  const card = orderCard(board, round);
  const acknowledge = card.getByRole('button', { name: 'Acknowledge completed work', exact: true });
  await expect(acknowledge).toBeEnabled();
  await acknowledge.click();
  await expect(card.getByText('Work complete', { exact: true })).toBeVisible();
}

async function readTaskAndSelectBucket(page: Page, api: APIRequestContext, orderId: string): Promise<ServerTask> {
  const task = await readServerTask(api, orderId);
  await page.goto('/en/server/tasks');
  const bucket = page.getByRole('tab', { name: new RegExp(`^${task.bucket} \\d+$`) });
  await expect(bucket).toBeVisible();
  await bucket.click();
  await expect(page.getByTestId(`server-task-${orderId}`)).toBeVisible();
  return task;
}

async function expectHandoverReason(
  page: Page,
  api: APIRequestContext,
  orderId: string,
  reasonCode: string,
  message: string,
): Promise<void> {
  const task = await readTaskAndSelectBucket(page, api, orderId);
  const action = task.permittedDeliveryActions.find((candidate) => candidate.action === 'HandOver');
  expect(action).toMatchObject({ allowed: false, reasonCode });
  const card = page.getByTestId(`server-task-${orderId}`);
  await expect(card).toContainText(message);
  await expect(card.getByRole('button', { name: message, exact: true })).toBeDisabled();
}

async function expectHandoverAllowed(page: Page, api: APIRequestContext, orderId: string): Promise<void> {
  const task = await readTaskAndSelectBucket(page, api, orderId);
  const action = task.permittedDeliveryActions.find((candidate) => candidate.action === 'HandOver');
  expect(action).toMatchObject({ allowed: true, reasonCode: null });
  await expect(page.getByTestId(`server-task-${orderId}`).getByRole('button', { name: /^Deliver/ })).toBeEnabled();
}

async function deliverTask(page: Page, order: CreatedRound): Promise<void> {
  const card = page.getByTestId(`server-task-${order.id}`);
  const delivered = await requirePostData<{ readonly id: string; readonly status: string }>(
    page,
    new RegExp(`^/api/staff/server-workspace/tasks/${order.id}/deliver$`),
    () => card.getByRole('button', { name: /^Deliver/ }).click(),
  );
  expect(delivered.id.toLowerCase()).toBe(order.id.toLowerCase());
  expect(delivered.status).toBe('Completed');
}

async function commitVoidAmendment(
  adminPage: Page,
  round: CreatedRound,
  startOrdinal: number,
  units: number,
  reason: string,
): Promise<CommittedAmendment> {
  await adminPage.goto(`/en/server/orders/${encodeURIComponent(round.id)}`);
  await adminPage.getByRole('button', { name: 'Amend order', exact: true }).click();
  const dialog = adminPage.getByRole('dialog');
  const line = dialog.getByRole('article').filter({ hasText: PRODUCT });
  await line.getByRole('combobox', { name: 'Change this line', exact: true }).selectOption('Void');
  await line.getByRole('spinbutton', { name: 'First unit number', exact: true }).fill(String(startOrdinal));
  await line.getByRole('spinbutton', { name: 'Units', exact: true }).fill(String(units));
  await dialog.getByLabel('Reason for this change').fill(reason);
  const preparingOverride = dialog.getByRole('checkbox', {
    name: 'I acknowledge this order has entered preparation and needs a kitchen correction.',
  });
  if (await preparingOverride.count()) await preparingOverride.check();
  await requirePostData(adminPage, new RegExp(`^/api/staff/orders/${round.id}/amendments/quote$`), () =>
    dialog.getByRole('button', { name: 'Get a quote', exact: true }).click(),
  );
  const committed = await requirePostData<CommittedAmendment>(
    adminPage,
    new RegExp(`^/api/staff/orders/${round.id}/amendments/commit$`),
    () => dialog.getByRole('button', { name: 'Confirm amendment', exact: true }).click(),
  );
  expect(committed.sourceOrderId.toLowerCase()).toBe(round.id.toLowerCase());
  expect(committed.amendmentId).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(dialog.getByText(/^Amendment committed/)).toBeVisible();
  const closeButton = dialog.getByRole('button', { name: 'Close', exact: true }).filter({ hasText: /^Close$/ });
  await expect(closeButton).toHaveCount(1);
  await closeButton.click();
  await expect(dialog).toHaveCount(0);
  return committed;
}

function expectNoPrinterRoutes(snapshot: NativeKitchenSnapshot, orderId: string): void {
  const order = snapshot.orders.find((item) => item.orderId.toLowerCase() === orderId.toLowerCase());
  expect(order).toBeDefined();
  expect(order?.requiredKitchenRoutes.length).toBeGreaterThan(0);
  expect(order?.requiredKitchenRoutes.every((route) => route.status === 'NotConfigured')).toBe(true);
}

async function assertPrivateDeviceAndCompletionEvidence(
  orderIds: readonly string[],
  expected: readonly {
    readonly orderId: string;
    readonly workItemId: string;
    readonly kind: 'InitialOrder' | 'AmendmentCorrection';
    readonly accountRevision: number | null;
  }[],
): Promise<void> {
  const client = await getE2EDbPool().connect();
  try {
    const receipts = await client.query<{ readonly count: number }>(
      'SELECT COUNT(*)::int AS count FROM "DeviceOrderReceipts" WHERE order_id = ANY($1::uuid[])',
      [orderIds],
    );
    expect(receipts.rows[0]?.count).toBe(0);

    const routes = await client.query<StoredRoute>(
      `SELECT status, device_id
       FROM "OrderRoutingStates"
       WHERE order_id = ANY($1::uuid[]) AND is_required = TRUE AND target <> 'Cashier'`,
      [orderIds],
    );
    expect(routes.rows.length).toBeGreaterThan(0);
    expect(routes.rows.every((route) => route.status === 'NotConfigured' && route.device_id === null)).toBe(true);
    expect(routes.rows.some((route) => route.status === 'Printed')).toBe(false);

    const completions = await client.query<StoredCompletion>(
      `SELECT order_id::text AS order_id, work_item_id::text AS work_item_id, kind,
              account_revision::text AS account_revision, acknowledged_order_version
       FROM kitchen_board_work_completions
       WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    );
    expect(completions.rows).toHaveLength(expected.length);
    for (const row of expected) {
      const completion = completions.rows.find(
        (candidate) =>
          candidate.order_id.toLowerCase() === row.orderId.toLowerCase() &&
          candidate.work_item_id.toLowerCase() === row.workItemId.toLowerCase() &&
          candidate.kind === row.kind,
      );
      expect(completion).toMatchObject({
        account_revision: row.accountRevision === null ? null : String(row.accountRevision),
      });
      expect(completion?.acknowledged_order_version).toBeGreaterThan(0);
    }
  } finally {
    client.release();
  }
}

p11Test(
  'no-printer kitchen board gates handover and visit close until exact work is acknowledged',
  async ({ browser, baseURL, p11Admin, p11Cashier, p11Server }) => {
    p11Test.setTimeout(15 * 60 * 1000);
    const contexts: BrowserContext[] = [];
    let api: APIRequestContext | undefined;
    let table: TableAccountP11Fixture | undefined;
    let guest: Awaited<ReturnType<typeof openGuestContext>> | undefined;
    const expectedCompletions: {
      orderId: string;
      workItemId: string;
      kind: 'InitialOrder' | 'AmendmentCorrection';
      accountRevision: number | null;
    }[] = [];
    const orderIds: string[] = [];

    try {
      table = await createTableAccountP11Fixture(p11Admin.accessToken);
      const apiOrigin = process.env.E2E_API_BASE_URL;
      if (!apiOrigin) throw new Error('The isolated P11 API origin is unavailable.');
      api = await request.newContext({
        baseURL: apiOrigin,
        extraHTTPHeaders: { Authorization: `Bearer ${p11Admin.accessToken}` },
      });

      const server = await openStaffContext(browser, baseURL, p11Server);
      contexts.push(server.context);
      const admin = await openStaffContext(browser, baseURL, p11Admin);
      contexts.push(admin.context);
      const cashier = await openStaffContext(browser, baseURL, p11Cashier);
      contexts.push(cashier.context);

      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await markTableReady(server.page, table.tableId);
      const session = await requirePostData<OpenSession>(server.page, /^\/api\/table-service-sessions$/, () =>
        server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      expect(session.status).toBe('Open');
      const oldVisitCode = await admissionCode(server.page);

      const firstRound = await addRound(server.page, table, session.serviceSessionId, 2);
      orderIds.push(firstRound.id);
      const board = await admin.context.newPage();
      board.setDefaultTimeout(25_000);
      await board.setViewportSize({ width: 1024, height: 768 });
      await board.goto('/en/kitchen-staff');
      expect(board.viewportSize()).toEqual({ width: 1024, height: 768 });
      const nativeTab = board.getByRole('tab', { name: 'Kitchen work', exact: true });
      await expect(nativeTab).toBeVisible();
      await expect(nativeTab).toHaveAttribute('aria-selected', 'true');
      await expect(board.getByRole('tab', { name: 'Marketplace orders', exact: true })).toBeVisible();
      await expect(board.getByRole('heading', { name: 'Kitchen work', exact: true })).toBeVisible();
      await refreshBoard(board);
      await expect(orderCard(board, firstRound)).toBeVisible();
      let snapshot = await readNativeKitchenSnapshot(api);
      expectNoPrinterRoutes(snapshot, firstRound.id);

      await setReadyOnBoard(board, firstRound);
      await expectHandoverReason(server.page, api, firstRound.id, 'KitchenWorkUnresolved', BASE_HANDOVER_BLOCK);
      await acknowledgeInitialWork(board, firstRound);
      expectedCompletions.push({
        orderId: firstRound.id,
        workItemId: firstRound.id,
        kind: 'InitialOrder',
        accountRevision: null,
      });
      const firstInitialCompletion = await readServerTask(api, firstRound.id);
      expect(
        firstInitialCompletion.permittedDeliveryActions.find((action) => action.action === 'HandOver'),
      ).toMatchObject({ allowed: true, reasonCode: null });

      const partial = await commitVoidAmendment(admin.page, firstRound, 1, 1, PARTIAL_REMOVAL_REASON);
      await resolveUnpaidAmendmentCredit(api, firstRound.id, partial.amendmentId, 1_500);
      await refreshBoard(board);
      snapshot = await readNativeKitchenSnapshot(api);
      const partialCorrection = snapshot.corrections.find(
        (item) => item.orderId.toLowerCase() === firstRound.id.toLowerCase(),
      );
      expect(partialCorrection).toMatchObject({
        workItemId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        amendmentId: partial.amendmentId,
        withdrawn: false,
        isCompleted: false,
        canComplete: true,
      });
      expect(partialCorrection?.accountRevision).toBeGreaterThan(0);
      expect(partialCorrection?.orderVersion).toBeGreaterThan(0);
      expect(partialCorrection?.changes).toHaveLength(1);
      expect(partialCorrection?.changes[0]?.kind).toBe('Void');
      await expect(correctionCard(board, firstRound.orderNumber)).toBeVisible();
      await expectHandoverReason(
        server.page,
        api,
        firstRound.id,
        'KitchenCorrectionUnresolved',
        CORRECTION_HANDOVER_BLOCK,
      );

      const partialCard = correctionCard(board, firstRound.orderNumber);
      const acknowledgeCorrection = partialCard.getByRole('button', { name: 'Acknowledge correction', exact: true });
      await expect(acknowledgeCorrection).toBeVisible();
      await expect(acknowledgeCorrection).toBeEnabled();
      if (!partialCorrection?.accountRevision) throw new Error('P11 correction revision was not returned.');
      await acknowledgeCorrectionWork(board, partialCorrection);
      expectedCompletions.push({
        orderId: firstRound.id,
        workItemId: partialCorrection.workItemId,
        kind: 'AmendmentCorrection',
        accountRevision: partialCorrection.accountRevision,
      });
      await expectHandoverAllowed(server.page, api, firstRound.id);

      // Cancel while the remaining dish is still ready: a served dish needs no kitchen stop notice.
      // The guest round below exercises the actual handover after its initial acknowledgement.
      const fullVoid = await commitVoidAmendment(admin.page, firstRound, 2, 1, FULL_REMOVAL_REASON);
      await resolveUnpaidAmendmentCredit(api, firstRound.id, fullVoid.amendmentId, 1_500);
      await assertOrderAmendmentsSettled(api, firstRound.id);
      await cancelFullyCreditedUnpaidOrder(api, firstRound.id);
      await refreshBoard(board);
      snapshot = await readNativeKitchenSnapshot(api);
      expect(snapshot.orders.some((item) => item.orderId.toLowerCase() === firstRound.id.toLowerCase())).toBe(false);
      const fullVoidCorrection = snapshot.corrections.find(
        (item) => item.orderId.toLowerCase() === firstRound.id.toLowerCase(),
      );
      expect(fullVoidCorrection).toMatchObject({
        amendmentId: fullVoid.amendmentId,
        status: 'Cancelled',
        withdrawn: false,
        isCompleted: false,
        canComplete: true,
      });
      expect(fullVoidCorrection?.changes).toHaveLength(1);
      expect(fullVoidCorrection?.changes[0]?.kind).toBe('Void');
      await expect(correctionCard(board, firstRound.orderNumber)).toBeVisible();

      guest = await openGuestContext(browser, baseURL);
      contexts.push(guest.context);
      const secondRound = await addGuestBasketRound(guest.page, api, table, session.serviceSessionId, oldVisitCode);
      orderIds.push(secondRound.id);
      await refreshBoard(board);
      await expect(orderCard(board, secondRound)).toBeVisible();
      snapshot = await readNativeKitchenSnapshot(api);
      expectNoPrinterRoutes(snapshot, secondRound.id);
      await setReadyOnBoard(board, secondRound);
      await acknowledgeInitialWork(board, secondRound);
      expectedCompletions.push({
        orderId: secondRound.id,
        workItemId: secondRound.id,
        kind: 'InitialOrder',
        accountRevision: null,
      });
      await expectHandoverAllowed(server.page, api, secondRound.id);
      await deliverTask(server.page, secondRound);

      await cashier.page.goto(`/en/cashier/tables?session=${encodeURIComponent(session.serviceSessionId)}`);
      const collection = cashier.page.getByRole('region', { name: 'Collect a contribution' });
      await expect(collection).toBeVisible();
      await collection.getByRole('button', { name: 'Review contribution', exact: true }).click();
      const review = cashier.page.getByRole('region', { name: 'Review contribution' });
      await review.getByRole('button', { name: 'Confirm reviewed contribution', exact: true }).click();
      await review.getByRole('button', { name: 'Exact', exact: true }).click();
      await review
        .getByLabel('I have received this cash or confirmed this card payment on the separate terminal.')
        .check();
      await review.getByRole('button', { name: 'Record confirmed payment', exact: true }).click();
      const receiptHeading = review.getByRole('heading', { name: 'Recorded cash receipt', exact: true });
      await expect(receiptHeading).toBeVisible();
      const receipt = receiptHeading.locator('..');
      const cashReceived = receipt.getByText('Cash received', { exact: true }).locator('..');
      await expect(cashReceived.getByRole('definition')).toHaveText('CHF 15.00');
      const change = receipt.getByText('Change', { exact: true }).locator('..');
      await expect(change.getByRole('definition')).toHaveText('CHF 0.00');

      const settledSessionResponse = await api.get(
        `/api/table-service-sessions/${encodeURIComponent(session.serviceSessionId)}`,
      );
      const settledSession = await requireApiData<{
        readonly status: string;
        readonly canClose: boolean;
        readonly hasPendingPaymentHandoff: boolean;
        readonly bill: { readonly remaining: number };
      }>(settledSessionResponse, 'cash-settled visit');
      expect(settledSession).toMatchObject({ status: 'Open', canClose: true, hasPendingPaymentHandoff: false });
      expect(settledSession.bill.remaining).toBe(0);

      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await server.page.reload();
      const closeVisit = server.page.getByRole('button', { name: 'Close visit', exact: true });
      await expect(closeVisit).toBeEnabled();
      await closeVisit.click();
      const closeDialog = server.page.getByRole('dialog');
      const failedClosePromise = server.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/table-service-sessions/${session.serviceSessionId}/close` &&
          response.request().method() === 'POST',
      );
      await closeDialog.getByRole('button', { name: 'Close visit', exact: true }).click();
      const failedClose = await failedClosePromise;
      expect(failedClose.ok()).toBe(true);
      const failedCloseBody = (await failedClose.json()) as ApiEnvelope<unknown>;
      expect(failedCloseBody).toMatchObject({ success: false, errorCode: 'KitchenCorrectionUnresolved' });
      const correctionCloseAlert = server.page.getByRole('alert').filter({ hasText: CORRECTION_CLOSE_BLOCK });
      await expect(correctionCloseAlert).toHaveText(CORRECTION_CLOSE_BLOCK);

      const fullVoidCard = correctionCard(board, firstRound.orderNumber);
      await expect(fullVoidCard.getByRole('button', { name: 'Acknowledge correction', exact: true })).toBeVisible();
      if (!fullVoidCorrection?.accountRevision) throw new Error('P11 terminal correction revision was not returned.');
      await acknowledgeCorrectionWork(board, fullVoidCorrection);
      expectedCompletions.push({
        orderId: firstRound.id,
        workItemId: fullVoidCorrection.workItemId,
        kind: 'AmendmentCorrection',
        accountRevision: fullVoidCorrection.accountRevision,
      });
      await refreshBoard(board);
      const remainingCorrection = (await readNativeKitchenSnapshot(api)).corrections.filter(
        (item) => item.orderId.toLowerCase() === firstRound.id.toLowerCase(),
      );
      expect(remainingCorrection).toHaveLength(0);

      await server.page.reload();
      await expect(server.page.getByRole('button', { name: 'Close visit', exact: true })).toBeEnabled();
      const closeAfterAck = server.page.getByRole('button', { name: 'Close visit', exact: true });
      await closeAfterAck.click();
      const closeAfterAckDialog = server.page.getByRole('dialog');
      const closed = await requirePostData<OpenSession>(
        server.page,
        new RegExp(`^/api/table-service-sessions/${session.serviceSessionId}/close$`),
        () => closeAfterAckDialog.getByRole('button', { name: 'Close visit', exact: true }).click(),
      );
      expect(closed.status).toBe('Closed');

      await assertPrivateDeviceAndCompletionEvidence(orderIds, expectedCompletions);
      await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await markTableReady(server.page, table.tableId);
      const nextSession = await requirePostData<OpenSession>(server.page, /^\/api\/table-service-sessions$/, () =>
        server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      expect(nextSession.status).toBe('Open');
      expect(nextSession.serviceSessionId.toLowerCase()).not.toBe(session.serviceSessionId.toLowerCase());
      const nextCode = await admissionCode(server.page);

      const nextGuest = await openGuestContext(browser, baseURL);
      contexts.push(nextGuest.context);
      await nextGuest.page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
      await expect(nextGuest.page.getByRole('heading', { name: 'Join this table visit' })).toBeVisible();
      await nextGuest.page.getByLabel('Table visit code').fill(oldVisitCode);
      await nextGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      const staleCodeAlert = nextGuest.page.getByRole('alert').filter({ hasText: 'We could not join this visit' });
      await expect(staleCodeAlert).toHaveCount(1);
      await nextGuest.page.getByLabel('Table visit code').fill(nextCode);
      await nextGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
      await expect(nextGuest.page).toHaveURL(/\/en\/menu$/);
      await nextGuest.page.goto('/en/table-account');
      await expect(nextGuest.page.getByRole('heading', { name: 'Table account', exact: true })).toBeVisible();
      await expect(nextGuest.page.locator('dl[aria-label="Table account totals"]')).toContainText('CHF 0.00');
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      await api?.dispose();
    }
  },
);
