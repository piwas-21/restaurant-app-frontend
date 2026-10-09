import { expect, type Browser, type Page } from '@playwright/test';
import type { P11StaffUser } from '../p11/staffUsers';
import type { TableAccountP11Fixture } from '../seed/tableAccountP11';

export const PRODUCT = 'E2E Test Product';

export async function responseData<T>(page: Page, pathname: RegExp, action: () => Promise<unknown>): Promise<T> {
  const pending = page.waitForResponse(
    (response) => pathname.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
  );
  await action();
  const response = await pending;
  const body = (await response.json()) as { success: boolean; data?: T };
  if (!response.ok() || body.success !== true || body.data === undefined)
    throw new Error(`Stripe acceptance application request failed with HTTP ${response.status()}.`);
  return body.data;
}

export async function openVisitContext(browser: Browser, baseURL: string, user?: P11StaffUser) {
  const context = await browser.newContext({ baseURL, ...(user ? { storageState: user.storageStatePath } : {}) });
  await context.addInitScript(() => {
    window.localStorage.setItem('i18nextLng', 'en');
    window.localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  return { context, page };
}

export async function openTableVisit(page: Page, table: TableAccountP11Fixture) {
  await page.goto(`/en/server/tables/${table.tableId}`);
  await responseData(page, new RegExp(`^/api/Tables/${table.tableId}/ready$`), () =>
    page.getByRole('button', { name: 'Ready for next guests', exact: true }).click(),
  );
  await page.reload();
  const session = await responseData<{ serviceSessionId: string; status: string }>(
    page,
    /^\/api\/table-service-sessions$/,
    () => page.getByRole('button', { name: 'Open Table', exact: true }).click(),
  );
  expect(session.status).toBe('Open');
  const panel = page.getByRole('region', { name: 'Guest visit code' });
  await panel.getByRole('button', { name: 'Generate new visit code', exact: true }).click();
  const code = await panel.locator('code').innerText();
  expect(code).toMatch(/^[A-Z0-9]{10}$/);
  return { sessionId: session.serviceSessionId, code };
}

export async function joinVisit(page: Page, table: TableAccountP11Fixture, code: string) {
  await page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
  await page.getByLabel('Table visit code').fill(code);
  await page.getByRole('button', { name: 'Join table', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/menu$/);
  await page.goto('/en/table-account');
  await expect(page.getByRole('heading', { name: 'Table account', exact: true })).toBeVisible();
}

export async function addThreeUnitRound(page: Page, tableId: string, sessionId: string) {
  await page.goto(`/en/server/tables/${tableId}/order?serviceSessionId=${encodeURIComponent(sessionId)}`);
  await page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true }).click();
  const increase = page.getByRole('button', { name: `Increase quantity of ${PRODUCT}`, exact: true });
  await increase.click();
  await increase.click();
  const order = await responseData<{ id: string; serviceSessionId: string; total: number }>(
    page,
    /^\/api\/staff\/orders\/round$/,
    () => page.getByRole('button', { name: 'Send to kitchen', exact: true }).click(),
  );
  expect(order.serviceSessionId.toLowerCase()).toBe(sessionId.toLowerCase());
  expect(order.total).toBe(45);
  return order.id;
}

export async function addSingleUnitRound(page: Page, tableId: string, sessionId: string) {
  await page.goto(`/en/server/tables/${tableId}/order?serviceSessionId=${encodeURIComponent(sessionId)}`);
  await page.getByRole('button', { name: `Add ${PRODUCT}`, exact: true }).click();
  const order = await responseData<{ id: string; serviceSessionId: string; total: number }>(
    page,
    /^\/api\/staff\/orders\/round$/,
    () => page.getByRole('button', { name: 'Send to kitchen', exact: true }).click(),
  );
  expect(order.serviceSessionId.toLowerCase()).toBe(sessionId.toLowerCase());
  expect(order.total).toBe(15);
  return order.id;
}
