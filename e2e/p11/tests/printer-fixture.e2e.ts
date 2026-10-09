import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { test as p11Test, type P11StaffUser } from '../staffUsers';
import { createTableAccountP11Fixture } from '../../seed/tableAccountP11';

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
  readonly serviceSessionId: string;
}

interface PrinterAcceptanceProfile {
  readonly runId: string;
  readonly apiOrigin: string;
  readonly printerApiKey: string;
  readonly adminAccessToken: string;
  readonly serverAccessToken: string;
  readonly tableId: string;
  readonly tableNumber: string;
  readonly serviceSessionId: string;
  readonly sourceOrderId: string;
}

async function openStaffPage(browser: Browser, baseURL: string | undefined, user: P11StaffUser) {
  if (!baseURL) throw new Error('P11 staff UI origin is unavailable.');
  const context = await browser.newContext({ storageState: user.storageStatePath, baseURL });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  return { context, page };
}

async function requirePostData<T>(page: Page, pathPattern: RegExp, action: () => Promise<unknown>): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) => pathPattern.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
  );
  await action();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`P11 printer fixture request was refused with HTTP ${response.status()}.`);
  }
  return body.data;
}

async function markTableReady(page: Page, tableId: string): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/Tables/${tableId}/ready` && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ready for next guests', exact: true }).click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`P11 printer table readiness was refused with HTTP ${response.status()}.`);
  await page.reload();
}

async function addServerRound(page: Page, tableId: string, sessionId: string): Promise<CreatedRound> {
  await page.goto(
    `/en/server/tables/${encodeURIComponent(tableId)}/order?serviceSessionId=${encodeURIComponent(sessionId)}`,
  );
  await expect(page.getByRole('button', { name: 'Add E2E Test Product', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add E2E Test Product', exact: true }).click();
  const round = await requirePostData<CreatedRound>(page, /^\/api\/staff\/orders\/round$/, () =>
    page.getByRole('button', { name: 'Send to kitchen', exact: true }).click(),
  );
  expect(round.serviceSessionId.toLowerCase()).toBe(sessionId.toLowerCase());
  return round;
}

p11Test(
  'prepares an isolated printer feed source and private staff profile',
  async ({ browser, baseURL, p11Admin, p11Server }) => {
    p11Test.setTimeout(3 * 60 * 1000);
    p11Test.skip(process.env.P11_KEEP_RUN !== '1', 'Only create printer credentials in a retained local P11 run.');

    const artifactDir = process.env.P11_ARTIFACT_DIR;
    const runId = process.env.P11_RUN_ID;
    const apiOrigin = process.env.E2E_API_BASE_URL;
    const printerApiKey = process.env.P11_PRINTER_API_KEY;
    if (!artifactDir || !runId || !apiOrigin || !printerApiKey) {
      throw new Error('The guarded P11 runner profile is incomplete.');
    }

    let staff: Awaited<ReturnType<typeof openStaffPage>> | undefined;
    try {
      const table = await createTableAccountP11Fixture(p11Admin.accessToken);
      const printerStaff = await openStaffPage(browser, baseURL, p11Server);
      staff = printerStaff;
      await printerStaff.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
      await markTableReady(printerStaff.page, table.tableId);
      const session = await requirePostData<OpenSession>(printerStaff.page, /^\/api\/table-service-sessions$/, () =>
        printerStaff.page.getByRole('button', { name: 'Open Table', exact: true }).click(),
      );
      expect(session.status).toBe('Open');

      const sourceOrder = await addServerRound(printerStaff.page, table.tableId, session.serviceSessionId);
      const profile: PrinterAcceptanceProfile = {
        runId,
        apiOrigin,
        printerApiKey,
        adminAccessToken: p11Admin.accessToken,
        serverAccessToken: p11Server.accessToken,
        tableId: table.tableId,
        tableNumber: table.tableNumber,
        serviceSessionId: session.serviceSessionId,
        sourceOrderId: sourceOrder.id,
      };

      const profilePath = path.join(artifactDir, 'printer-acceptance-profile.json');
      await writeFile(profilePath, JSON.stringify(profile, null, 2), { flag: 'wx', mode: 0o600 });
      await chmod(profilePath, 0o600);
      process.stdout.write(
        `P11 printer source ready: run=${runId}, table=${table.tableNumber}/${table.tableId}, ` +
          `session=${session.serviceSessionId}, order=${sourceOrder.id}; private profile=${profilePath}\n`,
      );
    } finally {
      await staff?.context.close();
    }
  },
);
