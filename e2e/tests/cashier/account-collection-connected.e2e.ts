import {
  expect,
  request,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
  type TestInfo,
} from '@playwright/test';
import { adminToken, credKeyForBaseUrl } from '../../helpers/adminAuth';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { apiBaseUrl } from '../../helpers/config';
import { test, type StaffUser } from '../../fixtures/accountCollectionUsers';
import { cleanupServerTableFixture, createServerTableFixture } from '../../seed/serverTableService';
import type { AccountPaymentAccount } from '../../../src/types/accountPaymentAccount';
import type { AccountEqualSharePlan, AccountPaymentOperation } from '../../../src/types/accountPayments';
import type { OrderDto } from '../../../src/types/order';
import type { ServerFloorSnapshot } from '../../../src/types/serverWorkspace';
import { formatAccountPaymentMinor } from '../../../src/lib/accountPaymentMoney';

const PRODUCT = 'E2E Test Product';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly errorCode?: string;
}

interface TableVisit {
  readonly serviceSessionId: string;
  readonly orderId: string;
}

async function selectServerTable(page: Page, tableId: string, tableNumber: string): Promise<string | undefined> {
  const floorResponsePromise = page.waitForResponse(
    (response) =>
      /\/api\/staff\/server-workspace\/floor$/i.test(new URL(response.url()).pathname) &&
      response.request().method() === 'GET',
  );
  await page.goto('/en/server/floor');
  await expect(page.getByTestId('server-floor-workspace')).toBeVisible();
  const role = await page.evaluate(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? (JSON.parse(stored) as { role?: unknown }).role : null;
    } catch {
      return null;
    }
  });
  expect(role).toBe('Server');
  const floorResponse = await floorResponsePromise;
  const floorBody = (await floorResponse.json()) as ApiEnvelope<ServerFloorSnapshot>;
  if (!floorResponse.ok() || floorBody.success !== true || !floorBody.data) {
    throw new Error(`Server floor read failed with HTTP ${floorResponse.status()}: ${floorBody.message ?? 'no data'}`);
  }
  const floorTable = floorBody.data.tables.find((table) => table.tableId.toLowerCase() === tableId.toLowerCase());
  if (!floorTable) throw new Error(`The authenticated Server floor did not include generated table ${tableNumber}.`);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const floorCard = page.locator('article').filter({ hasText: tableNumber });
  await floorCard.getByRole('link', { name: /Open Table/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: tableNumber, exact: true })).toBeVisible();
  await expect(page.getByTestId('server-table-workspace')).toBeVisible();
  expect(page.url()).toContain(`/en/server/tables/${encodeURIComponent(tableId)}`);
  if (floorTable.readinessState !== 'ReadyForGuests') {
    const readyButton = page.getByRole('button', { name: 'Ready for next guests', exact: true });
    if (await readyButton.isVisible().catch(() => false)) return floorTable.readinessState;
    const workspaceText = (await page.getByTestId('server-table-workspace').innerText()).slice(0, 500);
    throw new Error(
      `Server table ${tableNumber} has no readiness action. Floor state=${floorTable.state}, readiness=${floorTable.readinessState ?? 'missing'}, version=${floorTable.readinessVersion ?? 'missing'}, actions=${floorTable.permittedActions.join(',')}; page=${workspaceText}`,
    );
  }
  return floorTable.readinessState;
}

async function openStaffPage(browser: Browser, baseURL: string | undefined, user: StaffUser, width = 1280) {
  if (!baseURL) throw new Error('The connected E2E frontend origin is unavailable.');
  const context = await browser.newContext({
    storageState: user.storageStatePath,
    baseURL,
    viewport: { width, height: 844 },
  });
  await context.addInitScript(() => {
    localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  return { context, page };
}

async function postData<T>(
  page: Page,
  path: RegExp,
  action: () => Promise<unknown>,
): Promise<{ data: T; response: Response }> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
  );
  await action();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`Connected request ${path} failed with HTTP ${response.status()}: ${body.message ?? 'no data'}`);
  }
  return { data: body.data, response };
}

async function getData<T>(page: Page, path: RegExp, action: () => Promise<unknown>): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === 'GET',
  );
  await action();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`Connected read ${path} failed with HTTP ${response.status()}: ${body.message ?? 'no data'}`);
  }
  return body.data;
}

async function waitForGet(page: Page, path: RegExp, action: () => Promise<unknown>): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === 'GET',
  );
  await action();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Connected read ${path} failed with HTTP ${response.status()}.`);
}

async function getStaffData<T>(token: string, path: string): Promise<T> {
  const context = await request.newContext({
    baseURL: apiBaseUrl(),
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const response = await context.get(path);
    const body = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok() || body.success !== true || body.data === undefined) {
      throw new Error(
        `Connected read ${path} failed with HTTP ${response.status()}: ${body.message ?? body.errorCode ?? 'no data'}`,
      );
    }
    return body.data;
  } finally {
    await context.dispose();
  }
}

async function createVisitWithOrder(page: Page): Promise<{ tableId: string; tableNumber: string; visit: TableVisit }> {
  const table = await createServerTableFixture();
  const readinessState = await selectServerTable(page, table.tableId, table.tableNumber);
  if (readinessState !== 'ReadyForGuests') {
    const readyPath = new RegExp(`^/api/Tables/${table.tableId}/ready$`, 'i');
    const ready = await postData<unknown>(page, readyPath, () =>
      page.getByRole('button', { name: 'Ready for next guests', exact: true }).click(),
    );
    expect(ready.response.status()).toBe(200);
    await page.reload();
  }

  const opened = await postData<{ serviceSessionId: string; status: string }>(
    page,
    /^\/api\/table-service-sessions$/i,
    () => page.getByRole('button', { name: 'Open Table', exact: true }).click(),
  );
  expect(opened.data.status).toBe('Open');
  await page.goto(
    `/en/server/tables/${encodeURIComponent(table.tableId)}/order?serviceSessionId=${encodeURIComponent(opened.data.serviceSessionId)}`,
  );
  await page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true }).click();
  const round = await postData<{ id: string; serviceSessionId: string; total: number }>(
    page,
    /^\/api\/staff\/orders\/round$/i,
    () => page.getByRole('button', { name: 'Send to kitchen', exact: true }).click(),
  );
  expect(round.data.serviceSessionId.toLowerCase()).toBe(opened.data.serviceSessionId.toLowerCase());
  expect(round.data.total).toBe(15);
  return {
    tableId: table.tableId,
    tableNumber: table.tableNumber,
    visit: { serviceSessionId: opened.data.serviceSessionId, orderId: round.data.id },
  };
}

async function assertCashierPhoneLayout(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/cashier/orders');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  const measurements = await page.evaluate(() => {
    const shellHeader = document.querySelector('body header');
    const destinationHeader = document.querySelector('main section header');
    if (!(shellHeader instanceof HTMLElement) || !(destinationHeader instanceof HTMLElement)) {
      return { found: false, overflow: true, headerGap: -1, overlaps: ['missing header'] };
    }
    const visibleControls = Array.from(shellHeader.querySelectorAll<HTMLElement>('a,button,select')).filter(
      (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      },
    );
    const describe = (element: HTMLElement) =>
      element.getAttribute('aria-label')?.trim() || element.innerText.trim().replace(/\s+/g, ' ').slice(0, 60);
    const overlaps: string[] = [];
    for (let leftIndex = 0; leftIndex < visibleControls.length; leftIndex += 1) {
      const left = visibleControls[leftIndex].getBoundingClientRect();
      for (let rightIndex = leftIndex + 1; rightIndex < visibleControls.length; rightIndex += 1) {
        const right = visibleControls[rightIndex].getBoundingClientRect();
        if (
          left.left < right.right - 1 &&
          left.right > right.left + 1 &&
          left.top < right.bottom - 1 &&
          left.bottom > right.top + 1
        ) {
          const leftElement = visibleControls[leftIndex];
          const rightElement = visibleControls[rightIndex];
          overlaps.push(
            `${leftIndex}:${describe(leftElement)} (${Math.round(left.left)},${Math.round(left.top)},${Math.round(left.width)},${Math.round(left.height)}) <> ${rightIndex}:${describe(rightElement)} (${Math.round(right.left)},${Math.round(right.top)},${Math.round(right.width)},${Math.round(right.height)})`,
          );
        }
      }
    }
    return {
      found: true,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      headerGap: destinationHeader.getBoundingClientRect().top - shellHeader.getBoundingClientRect().bottom,
      overlaps,
    };
  });
  expect(measurements.found).toBe(true);
  expect(measurements.overflow).toBe(false);
  expect(measurements.headerGap).toBeGreaterThanOrEqual(-1);
  expect(measurements.overlaps).toEqual([]);
}

async function openCollection(page: Page, sessionId: string, orderId: string, resolveOrderLink: boolean) {
  const path = resolveOrderLink
    ? `/en/cashier/collection?order=${encodeURIComponent(orderId)}`
    : `/en/cashier/collection?serviceSessionId=${encodeURIComponent(sessionId)}`;
  const accountPath = new RegExp(`^/api/table-service-sessions/${sessionId}/account-payments$`, 'i');
  const accountResponsePromise = page.waitForResponse(
    (response) => accountPath.test(new URL(response.url()).pathname) && response.request().method() === 'GET',
  );
  await page.goto(path);
  const collection = page.getByRole('region', { name: 'Collect a contribution', exact: true });
  await expect(collection).toBeVisible();
  await expectNoA11yViolations(page);
  const form = collection.locator('form');
  await expect(form.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();
  const accountResponse = await accountResponsePromise;
  const accountBody = (await accountResponse.json()) as ApiEnvelope<AccountPaymentAccount>;
  if (!accountResponse.ok() || accountBody.success !== true || !accountBody.data) {
    throw new Error(`Connected account read failed with HTTP ${accountResponse.status()}.`);
  }
  return { collection, form, account: accountBody.data };
}

async function quoteCurrentMode(page: Page, sessionId: string, form: Locator) {
  const pattern = new RegExp(`^/api/table-service-sessions/${sessionId}/account-payments/quotes$`, 'i');
  return postData<AccountPaymentOperation>(page, pattern, () =>
    form.getByRole('button', { name: 'Review contribution', exact: true }).click(),
  );
}

async function captureCollectionScreenshots(page: Page, testInfo: TestInfo): Promise<void> {
  const capture = async (name: string) => {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: 'image/png' });
  };

  await page.setViewportSize({ width: 1280, height: 844 });
  await capture('collection-light-desktop');
  await page.getByRole('button', { name: 'Switch to Dark Mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await capture('collection-dark-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('collection-dark-390');
  await page.getByRole('button', { name: 'Switch to Light Mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await capture('collection-light-390');
}

async function verifyQuoteRecovery(
  page: Page,
  accessToken: string,
  sessionId: string,
  quote: AccountPaymentOperation,
): Promise<void> {
  const operationPath = new RegExp(
    `^/api/table-service-sessions/${sessionId}/account-payments/operations/${quote.operationId}$`,
    'i',
  );
  await waitForGet(page, operationPath, () => page.reload());
  const readback = await getStaffData<AccountPaymentOperation>(
    accessToken,
    `/api/table-service-sessions/${sessionId}/account-payments/operations/${quote.operationId}`,
  );
  expect(readback).toMatchObject({ operationId: quote.operationId, mode: quote.mode, state: 'Quoted' });
  const review = page.getByRole('region', { name: 'Review contribution', exact: true });
  await expect(review).toBeVisible();
  await expectReviewSummary(review, readback);
  await expect(page.getByRole('button', { name: 'Confirm reviewed contribution', exact: true })).toBeVisible();
}

async function expectReviewSummary(review: Locator, operation: AccountPaymentOperation): Promise<void> {
  const amount = formatAccountPaymentMinor(operation.amountMinor, operation.currency, 'en');
  const modeLabels: Record<AccountPaymentOperation['mode'], string> = {
    Full: 'Full bill',
    Items: 'Contribution by selected items',
    Amount: 'Contribution by amount',
    Equal: 'Equal-share contribution',
    CustomAmount: 'Custom per-guest contribution',
  };
  expect(amount).not.toBeNull();
  await expect(review.locator('h4')).toHaveText(amount ?? '');
  await expect(review).toContainText(modeLabels[operation.mode]);
  if ((operation.tipMinor ?? 0) > 0) {
    const tip = formatAccountPaymentMinor(operation.tipMinor ?? 0, operation.currency, 'en');
    expect(tip).not.toBeNull();
    await expect(review).toContainText(tip ?? '');
  }
}

test('real cashier UI quotes and reopens all five table-account modes without collecting money @connected-account-collection', async ({
  browser,
  baseURL,
  accountServerUser,
  accountCashierUser,
}, testInfo) => {
  test.setTimeout(240_000);
  const contexts: BrowserContext[] = [];
  const tables: string[] = [];
  const cashierWrites: string[] = [];
  const quoteWrites: string[] = [];
  try {
    const server = await openStaffPage(browser, baseURL, accountServerUser);
    contexts.push(server.context);
    const cashier = await openStaffPage(browser, baseURL, accountCashierUser, 390);
    contexts.push(cashier.context);
    cashier.page.on('request', (requestValue) => {
      if (requestValue.method() !== 'POST') return;
      const path = new URL(requestValue.url()).pathname;
      if (/\/account-payments\/quotes$/i.test(path)) quoteWrites.push(path);
      if (
        /\/account-payments\/operations\/[^/]+\/(?:reserve|collect|release)$|\/(?:table-service-sessions|orders|Orders)\/[^/]+\/payments$/i.test(
          path,
        )
      ) {
        cashierWrites.push(path);
      }
    });

    await assertCashierPhoneLayout(cashier.page);
    const modes: readonly { readonly name: string; readonly choice: string }[] = [
      { name: 'Full', choice: 'Full' },
      { name: 'Amount', choice: 'Amount' },
      { name: 'Items', choice: 'Items' },
      { name: 'Equal', choice: 'Equal' },
      { name: 'CustomAmount', choice: 'CustomAmount' },
    ];

    for (const [index, mode] of modes.entries()) {
      const { tableId, visit } = await createVisitWithOrder(server.page);
      tables.push(tableId);
      const { collection, form, account } = await openCollection(
        cashier.page,
        visit.serviceSessionId,
        visit.orderId,
        index === 0,
      );
      expect(account).toMatchObject({
        serviceSessionId: visit.serviceSessionId,
        currency: 'CHF',
        availableMinor: 1500,
      });
      if (index === 0) await captureCollectionScreenshots(cashier.page, testInfo);

      const choice = form.getByRole('combobox', { name: 'Collect a contribution', exact: true });
      if (mode.choice !== 'Full') await choice.selectOption(mode.choice);

      if (mode.choice === 'Amount') {
        await form.getByLabel('Contribution amount', { exact: true }).fill('5.01');
      } else if (mode.choice === 'Items') {
        await form.getByRole('checkbox').first().check();
      } else if (mode.choice === 'Equal') {
        await form.getByLabel('Number of people', { exact: true }).fill('3');
        const createdPlan = await postData<AccountEqualSharePlan>(
          cashier.page,
          new RegExp(`^/api/table-service-sessions/${visit.serviceSessionId}/account-payments/equal-share-plans$`, 'i'),
          () => form.getByRole('button', { name: 'Review and create shares', exact: true }).click(),
        );
        expect(createdPlan.data).toMatchObject({ totalMinor: account.availableMinor, shareCount: 3 });
        await waitForGet(
          cashier.page,
          new RegExp(`^/api/table-service-sessions/${visit.serviceSessionId}/account-payments$`, 'i'),
          () => cashier.page.reload(),
        );
        const updatedAccount = await getStaffData<AccountPaymentAccount>(
          accountCashierUser.accessToken,
          `/api/table-service-sessions/${visit.serviceSessionId}/account-payments`,
        );
        expect(updatedAccount.activeEqualSharePlan?.slots.map((slot) => slot.amountMinor)).toEqual([500, 500, 500]);
        await choice.selectOption('Equal');
        await expect(choice).toHaveValue('Equal');
        const shareSelector = form.getByRole('combobox', { name: 'Choose an unpaid share', exact: true });
        await expect(shareSelector).toBeVisible();
        await shareSelector.selectOption('1');
      } else if (mode.choice === 'CustomAmount') {
        await form.getByLabel('Guest 1 amount', { exact: true }).fill('14.40');
        await form.getByLabel('Guest 2 amount', { exact: true }).fill('0.40');
        await expect(form.getByRole('status')).toContainText(/0[.,]20 remains unassigned\./);
        await form.getByRole('button', { name: 'Fill remainder', exact: true }).nth(1).click();
        await expect(form.getByLabel('Guest 2 amount', { exact: true })).toHaveValue('0.60');
        const createdPlan = await postData<AccountEqualSharePlan>(
          cashier.page,
          new RegExp(`^/api/table-service-sessions/${visit.serviceSessionId}/account-payments/equal-share-plans$`, 'i'),
          () => form.getByRole('button', { name: 'Review and create shares', exact: true }).click(),
        );
        expect(createdPlan.data.customAmountsMinor).toEqual([1440, 60]);
        expect(createdPlan.response.request().postDataJSON()).toMatchObject({ customAmountsMinor: [1440, 60] });
        await waitForGet(
          cashier.page,
          new RegExp(`^/api/table-service-sessions/${visit.serviceSessionId}/account-payments$`, 'i'),
          () => cashier.page.reload(),
        );
        const updatedAccount = await getStaffData<AccountPaymentAccount>(
          accountCashierUser.accessToken,
          `/api/table-service-sessions/${visit.serviceSessionId}/account-payments`,
        );
        expect(updatedAccount.activeEqualSharePlan?.slots.map((slot) => slot.amountMinor)).toEqual([1440, 60]);
        await choice.selectOption('CustomAmount');
        await expect(choice).toHaveValue('CustomAmount');
        const shareSelector = form.getByRole('combobox', { name: 'Choose an unpaid share', exact: true });
        await expect(shareSelector).toBeVisible();
        await shareSelector.selectOption('2');
      }

      let expectedTipMinor = 0;
      if (mode.choice === 'Full') {
        const quoteCountBeforeInvalidTip = quoteWrites.length;
        await form.getByRole('button', { name: /^10%/ }).click();
        const customTip = form.getByLabel(/Enter custom tip amount/i);
        await customTip.fill('12.345');
        await expect(form.getByRole('alert')).toContainText('Enter a non-negative tip');
        await expect(form.getByRole('button', { name: 'Review contribution', exact: true })).toBeDisabled();
        expect(quoteWrites).toHaveLength(quoteCountBeforeInvalidTip);
        await customTip.fill('1.25');
        await expect(form.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();
        expectedTipMinor = 125;
      }

      const quoteResponse = await quoteCurrentMode(cashier.page, visit.serviceSessionId, form);
      const quote = quoteResponse.data;
      expect(quote).toMatchObject({
        mode: mode.name,
        paymentMethod: 'Cash',
        state: 'Quoted',
        tipMinor: expectedTipMinor,
      });
      if (mode.choice === 'Amount') expect(quote.amountMinor).toBe(501);
      if (mode.choice === 'Items') expect(quote.amountMinor).toBe(1500);
      if (mode.choice === 'Equal') expect(quote.equalShareOrdinal).toBe(1);
      if (mode.choice === 'CustomAmount') expect(quote).toMatchObject({ customShareOrdinal: 2, amountMinor: 60 });
      await expect(collection.getByRole('region', { name: 'Review contribution', exact: true })).toBeVisible();
      await expectReviewSummary(collection.getByRole('region', { name: 'Review contribution', exact: true }), quote);
      await verifyQuoteRecovery(cashier.page, accountCashierUser.accessToken, visit.serviceSessionId, quote);
    }

    expect(cashierWrites).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await Promise.allSettled(tables.map((tableId) => cleanupServerTableFixture(tableId)));
  }
});

test('cashier reserves and collects one tipped cash contribution with exact ledger readback @connected-account-collection', async ({
  browser,
  baseURL,
  accountServerUser,
  accountCashierUser,
}) => {
  test.setTimeout(180_000);
  const contexts: BrowserContext[] = [];
  let tableId: string | undefined;
  try {
    const server = await openStaffPage(browser, baseURL, accountServerUser);
    contexts.push(server.context);
    const cashier = await openStaffPage(browser, baseURL, accountCashierUser);
    contexts.push(cashier.context);
    const visit = await createVisitWithOrder(server.page);
    tableId = visit.tableId;
    const { collection, form } = await openCollection(
      cashier.page,
      visit.visit.serviceSessionId,
      visit.visit.orderId,
      false,
    );
    await form.getByRole('button', { name: /^10%/ }).click();
    const customTip = form.getByLabel(/Enter custom tip amount/i);
    await expect(customTip).toHaveValue('1.50');
    await customTip.fill('1.25');
    await expect(customTip).toHaveValue('1.25');
    await expect(form.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();
    const quote = await quoteCurrentMode(cashier.page, visit.visit.serviceSessionId, form);
    expect(quote.data).toMatchObject({ mode: 'Full', amountMinor: 1500, tipMinor: 125, paymentMethod: 'Cash' });
    expect(quote.data.cashSettlement).toMatchObject({
      paymentMethod: 'Cash',
      currency: 'CHF',
      exactAmountMinor: 1625,
    });
    await expect(
      cashier.page.getByRole('button', { name: 'Confirm reviewed contribution', exact: true }),
    ).toBeEnabled();

    const reserve = await postData<AccountPaymentOperation>(
      cashier.page,
      new RegExp(
        `^/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments/operations/${quote.data.operationId}/reserve$`,
        'i',
      ),
      () => cashier.page.getByRole('button', { name: 'Confirm reviewed contribution', exact: true }).click(),
    );
    expect(reserve.data.state).toBe('Reserved');
    const dueMinor = reserve.data.cashSettlement?.dueAmountMinor;
    expect(dueMinor).toBeGreaterThan(0);
    await cashier.page.getByLabel('Cash received', { exact: true }).fill((((dueMinor ?? 0) + 500) / 100).toFixed(2));
    await cashier.page
      .getByLabel('I have received this cash or confirmed this card payment on the separate terminal.', { exact: true })
      .check();

    const captured = await postData<AccountPaymentOperation>(
      cashier.page,
      new RegExp(
        `^/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments/operations/${quote.data.operationId}/collect$`,
        'i',
      ),
      () => cashier.page.getByRole('button', { name: 'Record confirmed payment', exact: true }).click(),
    );
    expect(captured.data).toMatchObject({
      state: 'Captured',
      amountMinor: 1500,
      tipMinor: 125,
      cashReceipt: { receivedMinor: (dueMinor ?? 0) + 500, changeMinor: 500 },
    });
    await expect(collection.getByRole('region', { name: 'Review contribution', exact: true })).toContainText(
      'Cash received',
    );

    await waitForGet(
      cashier.page,
      new RegExp(`^/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments$`, 'i'),
      () => cashier.page.reload(),
    );
    const account = await getStaffData<AccountPaymentAccount>(
      accountCashierUser.accessToken,
      `/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments`,
    );
    expect(account).toMatchObject({ availableMinor: 0, capturedAccountPaymentMinor: 1500 });
    const paymentReadback = await getStaffData<AccountPaymentOperation>(
      accountCashierUser.accessToken,
      `/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments/operations/${captured.data.operationId}`,
    );
    expect(paymentReadback).toMatchObject({
      operationId: captured.data.operationId,
      state: 'Captured',
      amountMinor: 1500,
      tipMinor: 125,
      cashSettlement: { exactAmountMinor: 1625, dueAmountMinor: 1625 },
      cashReceipt: { exactAmountMinor: 1625, dueAmountMinor: 1625, receivedMinor: 2125, changeMinor: 500 },
    });
    await cashier.page.goto(`/en/cashier/collection?order=${encodeURIComponent(visit.visit.orderId)}`);
    const order = await getStaffData<OrderDto>(accountCashierUser.accessToken, `/api/orders/${visit.visit.orderId}`);
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0]).toMatchObject({ amount: 15, paymentMethod: 'Cash' });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    if (tableId) await cleanupServerTableFixture(tableId);
  }
});

test('server collection route uses the shared visit contribution UI and returns to its table @connected-account-collection', async ({
  browser,
  baseURL,
  accountServerUser,
  accountCashierUser,
}) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  let tableId: string | undefined;
  try {
    const server = await openStaffPage(browser, baseURL, accountServerUser);
    contexts.push(server.context);
    const visit = await createVisitWithOrder(server.page);
    tableId = visit.tableId;
    const accountPath = new RegExp(
      `^/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments$`,
      'i',
    );
    const accountResponse = server.page.waitForResponse(
      (response) => accountPath.test(new URL(response.url()).pathname) && response.request().method() === 'GET',
    );
    await server.page.goto(
      `/en/server/collection?serviceSessionId=${encodeURIComponent(visit.visit.serviceSessionId)}&tableId=${encodeURIComponent(visit.tableId)}`,
    );
    await expect(server.page.getByRole('region', { name: 'Collect a contribution', exact: true })).toBeVisible();
    await expectNoA11yViolations(server.page);
    const collection = server.page.getByRole('region', { name: 'Collect a contribution', exact: true });
    const form = collection.locator('form');
    await expect(form.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();
    const choice = form.getByRole('combobox', { name: 'Collect a contribution', exact: true });
    await choice.selectOption('Amount');
    await form.getByLabel('Contribution amount', { exact: true }).fill('5.00');
    const serverQuote = await quoteCurrentMode(server.page, visit.visit.serviceSessionId, form);
    expect(serverQuote.data).toMatchObject({ mode: 'Amount', amountMinor: 500, state: 'Quoted' });
    await expectReviewSummary(
      collection.getByRole('region', { name: 'Review contribution', exact: true }),
      serverQuote.data,
    );
    const back = server.page.getByRole('link', { name: 'Back to tables', exact: true });
    await expect(back).toHaveAttribute(
      'href',
      new RegExp(`/server/tables/${visit.tableId}\\?serviceSessionId=${visit.visit.serviceSessionId}`),
    );
    await expect(back).toBeDisabled();
    await server.page.getByLabel('I confirm no money was collected for this contribution.', { exact: true }).check();
    const released = await postData<AccountPaymentOperation>(
      server.page,
      new RegExp(
        `^/api/table-service-sessions/${visit.visit.serviceSessionId}/account-payments/operations/${serverQuote.data.operationId}/release$`,
        'i',
      ),
      () => server.page.getByRole('button', { name: 'Release this contribution', exact: true }).click(),
    );
    expect(released.data.state).toBe('Released');
    await expect(back).toBeEnabled();
    await back.click();
    await expect(server.page).toHaveURL(
      new RegExp(`/en/server/tables/${visit.tableId}\\?serviceSessionId=${visit.visit.serviceSessionId}`),
    );
    const response = await accountResponse;
    const envelope = (await response.json()) as ApiEnvelope<AccountPaymentAccount>;
    expect(response.ok()).toBe(true);
    expect(envelope.data).toMatchObject({ serviceSessionId: visit.visit.serviceSessionId, availableMinor: 1500 });

    const cashier = await openStaffPage(browser, baseURL, accountCashierUser);
    contexts.push(cashier.context);
    await cashier.page.goto(
      `/en/cashier/collection?serviceSessionId=${encodeURIComponent(visit.visit.serviceSessionId)}&returnTo=orders`,
    );
    await expect(cashier.page.getByRole('region', { name: 'Collect a contribution', exact: true })).toBeVisible();
    await expect(cashier.page.getByRole('link', { name: 'Back to orders', exact: true })).toHaveAttribute(
      'href',
      '/en/cashier/orders',
    );
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    if (tableId) await cleanupServerTableFixture(tableId);
  }
});

test('session collection checks an unresolved child tender before enabling account writes @connected-account-collection', async ({
  browser,
  baseURL,
  accountServerUser,
  accountCashierUser,
}) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  let tableId: string | undefined;
  try {
    const server = await openStaffPage(browser, baseURL, accountServerUser);
    contexts.push(server.context);
    const cashier = await openStaffPage(browser, baseURL, accountCashierUser);
    contexts.push(cashier.context);
    const accountWrites: string[] = [];
    cashier.page.on('request', (requestValue) => {
      if (requestValue.method() === 'POST' && /\/account-payments\//i.test(new URL(requestValue.url()).pathname)) {
        accountWrites.push(new URL(requestValue.url()).pathname);
      }
    });
    const visit = await createVisitWithOrder(server.page);
    tableId = visit.tableId;

    const legacyPaymentWrites: string[] = [];
    const operationLookups: string[] = [];
    cashier.page.on('request', (requestValue) => {
      const path = new URL(requestValue.url()).pathname;
      if (requestValue.method() === 'POST' && /^\/api\/orders\/[^/]+\/payments$/i.test(path)) {
        legacyPaymentWrites.push(path);
      }
      if (
        requestValue.method() === 'POST' &&
        /\/api\/table-service-sessions\/[^/]+\/account-payments(?:\/|$)/i.test(path)
      ) {
        accountWrites.push(path);
      }
    });
    cashier.page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (response.request().method() === 'GET' && /\/api\/orders\/[^/]+\/payments\/operations\/[^/]+$/i.test(path)) {
        operationLookups.push(path);
      }
    });
    await cashier.page.goto(
      `/en/cashier/collection?serviceSessionId=${encodeURIComponent(visit.visit.serviceSessionId)}`,
    );
    const review = cashier.page.getByRole('button', { name: 'Review contribution', exact: true });
    await expect(review).toBeEnabled();
    const operationId = 'f88fca12-f5d4-4a9d-9a00-375de5a90010';
    await cashier.page.evaluate(
      ({ orderId, savedOperationId }) => {
        window.sessionStorage.setItem(
          'cashier.pending-payment',
          JSON.stringify({ orderId, operationId: savedOperationId, paymentMethod: 'Cash', amount: 15 }),
        );
      },
      { orderId: visit.visit.orderId, savedOperationId: operationId },
    );

    const lookupPath = new RegExp(`^/api/orders/${visit.visit.orderId}/payments/operations/${operationId}$`, 'i');
    const lookup = cashier.page.waitForResponse(
      (response) => lookupPath.test(new URL(response.url()).pathname) && response.request().method() === 'GET',
    );
    await cashier.page.reload();
    const firstLookup = await lookup;
    expect([200, 404]).toContain(firstLookup.status());
    const firstEnvelope = (await firstLookup.json()) as ApiEnvelope<AccountPaymentOperation>;
    if (firstLookup.status() === 200) {
      expect(firstEnvelope.success).toBe(true);
      expect(firstEnvelope.data?.operationId.toLowerCase()).toBe(operationId);
    } else {
      expect(firstEnvelope.success).toBe(false);
      expect(firstEnvelope.errorCode || firstEnvelope.message).toBeTruthy();
    }
    await expect(review).toBeDisabled();
    await expect(cashier.page.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled();

    const repeatedLookup = cashier.page.waitForResponse(
      (response) => lookupPath.test(new URL(response.url()).pathname) && response.request().method() === 'GET',
    );
    await cashier.page.getByRole('button', { name: 'Check again', exact: true }).click();
    await repeatedLookup;
    await expect(review).toBeDisabled();
    expect(operationLookups.map((path) => path.toLowerCase())).toEqual([
      `/api/orders/${visit.visit.orderId}/payments/operations/${operationId}`.toLowerCase(),
      `/api/orders/${visit.visit.orderId}/payments/operations/${operationId}`.toLowerCase(),
    ]);
    expect(legacyPaymentWrites).toEqual([]);
    expect(accountWrites).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    if (tableId) await cleanupServerTableFixture(tableId);
  }
});

test('server recovery releases occupancy, readiness resets it, and the old visit remains owed @connected-account-collection', async ({
  browser,
  baseURL,
  accountServerUser,
  accountCashierUser,
}) => {
  test.setTimeout(180_000);
  const contexts: BrowserContext[] = [];
  let tableId: string | undefined;
  try {
    const server = await openStaffPage(browser, baseURL, accountServerUser);
    contexts.push(server.context);
    const cashier = await openStaffPage(browser, baseURL, accountCashierUser);
    contexts.push(cashier.context);
    const visit = await createVisitWithOrder(server.page);
    tableId = visit.tableId;
    await selectServerTable(server.page, visit.tableId, visit.tableNumber);
    await server.page.goto(
      `/en/server/tables/${encodeURIComponent(visit.tableId)}?serviceSessionId=${encodeURIComponent(visit.visit.serviceSessionId)}`,
    );
    await expect(server.page.getByRole('button', { name: 'Review table recovery', exact: true })).toBeEnabled();
    const previewPath = new RegExp(`^/api/Tables/${visit.tableId}/occupancy-recovery$`, 'i');
    const preview = await getData<{
      readonly tableId: string;
      readonly serviceSessionId: string | null;
      readonly preservedOutstandingAmount: number;
      readonly previewFingerprint: string;
      readonly readinessVersion: number;
      readonly sessionVersion: number | null;
      readonly accountRevision: number | null;
    }>(server.page, previewPath, () =>
      server.page.getByRole('button', { name: 'Review table recovery', exact: true }).click(),
    );
    expect(preview).toMatchObject({
      tableId: visit.tableId,
      serviceSessionId: visit.visit.serviceSessionId,
      preservedOutstandingAmount: 15,
    });
    await expect(server.page.getByRole('dialog', { name: `Recover table ${visit.tableNumber}` })).toBeVisible();
    await server.page
      .getByLabel('Reason for this audited recovery', { exact: true })
      .fill('Connected E2E physical table recovery');
    const recovered = await postData<{
      readonly operationId: string;
      readonly reason: string;
      readonly visitReleasedAt: string | null;
      readonly tableId: string;
      readonly serviceSessionId: string | null;
      readonly preservedOutstandingAmount: number;
      readonly retainedPriorVisitCount: number;
      readonly readinessState: string;
    }>(server.page, previewPath, () =>
      server.page.getByRole('button', { name: 'Release table occupancy', exact: true }).click(),
    );
    expect(recovered.data).toMatchObject({
      tableId: visit.tableId,
      serviceSessionId: visit.visit.serviceSessionId,
      preservedOutstandingAmount: 15,
      retainedPriorVisitCount: 1,
      readinessState: 'NeedsReset',
    });
    expect(recovered.data.visitReleasedAt).toBeTruthy();
    const receipt = await getStaffData<{
      readonly operationId: string;
      readonly tableId: string;
      readonly serviceSessionId: string | null;
      readonly reason: string;
      readonly visitReleasedAt: string | null;
      readonly preservedOutstandingAmount: number;
      readonly retainedPriorVisitCount: number;
      readonly orders: readonly {
        readonly orderId: string;
        readonly disposition: string;
        readonly originalRemainingAmount: number;
        readonly wasKitchenReleased: boolean;
        readonly hadRoutingHistory: boolean;
      }[];
    }>(
      accountServerUser.accessToken,
      `/api/Tables/${visit.tableId}/occupancy-recovery/operations/${encodeURIComponent(recovered.data.operationId)}`,
    );
    expect(receipt).toMatchObject({
      operationId: recovered.data.operationId,
      tableId: visit.tableId,
      serviceSessionId: visit.visit.serviceSessionId,
      reason: 'Connected E2E physical table recovery',
      visitReleasedAt: expect.any(String),
      preservedOutstandingAmount: 15,
      retainedPriorVisitCount: 1,
    });
    expect(receipt.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: visit.visit.orderId,
          disposition: 'RetainedInPriorVisit',
          originalRemainingAmount: 15,
          wasKitchenReleased: true,
          hadRoutingHistory: true,
        }),
      ]),
    );
    const preservedOrder = await getStaffData<OrderDto>(
      accountServerUser.accessToken,
      `/api/orders/${visit.visit.orderId}`,
    );
    expect(preservedOrder).toMatchObject({ isKitchenReleased: true, remainingAmount: 15 });
    expect(preservedOrder.kitchenReleasedAt).toBeTruthy();

    const readyPath = new RegExp(`^/api/Tables/${visit.tableId}/ready$`, 'i');
    const ready = await postData<unknown>(server.page, readyPath, () =>
      server.page.getByRole('button', { name: 'Ready for next guests', exact: true }).click(),
    );
    expect(ready.response.status()).toBe(200);
    const opened = await postData<{ readonly serviceSessionId: string; readonly status: string }>(
      server.page,
      /^\/api\/table-service-sessions$/i,
      () => server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
    );
    expect(opened.data).toMatchObject({ status: 'Open' });
    expect(opened.data.serviceSessionId).not.toBe(visit.visit.serviceSessionId);

    const oldVisit = await openCollection(cashier.page, visit.visit.serviceSessionId, visit.visit.orderId, false);
    expect(oldVisit.account.availableMinor).toBe(1500);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    if (tableId) await cleanupServerTableFixture(tableId);
  }
});

test('server-issued six-character visit code joins through the public scanned-table form @connected-account-collection', async ({
  browser,
  baseURL,
  accountServerUser,
}) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  let tableId: string | undefined;
  let api: Awaited<ReturnType<typeof request.newContext>> | undefined;
  try {
    const table = await createServerTableFixture();
    tableId = table.tableId;
    const server = await openStaffPage(browser, baseURL, accountServerUser);
    contexts.push(server.context);
    api = await request.newContext({ baseURL: apiBaseUrl() });
    const admin = await adminToken(api, apiBaseUrl(), credKeyForBaseUrl(baseURL ?? ''));
    if (!admin.token)
      throw new Error(`Admin QR setup credential was unavailable: ${admin.reason ?? 'unknown reason'}.`);
    const qrApi = await request.newContext({
      baseURL: apiBaseUrl(),
      extraHTTPHeaders: { Authorization: `Bearer ${admin.token}` },
    });
    try {
      const qrResponse = await qrApi.post(`/api/Tables/${encodeURIComponent(table.tableId)}/generate-qr`);
      const qrBody = (await qrResponse.json()) as ApiEnvelope<{ qrCodeData: string }>;
      if (!qrResponse.ok() || !qrBody.data?.qrCodeData) throw new Error('The Admin QR setup request failed.');

      const readinessState = await selectServerTable(server.page, table.tableId, table.tableNumber);
      if (readinessState !== 'ReadyForGuests') {
        const ready = await postData<unknown>(
          server.page,
          new RegExp(`^/api/Tables/${table.tableId}/ready$`, 'i'),
          () => server.page.getByRole('button', { name: 'Ready for next guests', exact: true }).click(),
        );
        expect(ready.response.status()).toBe(200);
        await server.page.reload();
      }
      const opened = await postData<{ serviceSessionId: string; status: string }>(
        server.page,
        /^\/api\/table-service-sessions$/i,
        () => server.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      const codePanel = server.page.getByRole('region', { name: 'Guest visit code', exact: true });
      const codeResponse = await postData<{ admissionCode: string }>(
        server.page,
        /^\/api\/table-guest-visits\/[^/]+\/admission-code$/i,
        () => codePanel.getByRole('button', { name: 'Generate new visit code', exact: true }).click(),
      );
      const code = codeResponse.data.admissionCode;
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);

      const guestContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
      contexts.push(guestContext);
      const guest = await guestContext.newPage();
      const joined = postData<{ serviceSessionId: string }>(guest, /^\/api\/table-guest-visits\/join$/i, async () => {
        await guest.goto(`/en/scan?qr=${encodeURIComponent(qrBody.data!.qrCodeData)}`);
        await expect(guest.getByLabel('Table visit code')).toBeVisible();
        await guest.getByLabel('Table visit code').fill(code.slice(0, 3) + ' ' + code.slice(3));
        await guest.getByRole('button', { name: 'Join table', exact: true }).click();
      });
      const join = await joined;
      expect(join.data.serviceSessionId.toLowerCase()).toBe(opened.data.serviceSessionId.toLowerCase());
      await expect(guest).toHaveURL(/\/en\/menu$/);
    } finally {
      await qrApi.dispose();
    }
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await api?.dispose();
    if (tableId) await cleanupServerTableFixture(tableId);
  }
});
