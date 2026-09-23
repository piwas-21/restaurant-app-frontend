import { expect, mergeTests, type Browser, type BrowserContext, type Page, type ViewportSize } from '@playwright/test';
import { test as cashierTest } from '../../fixtures/cashierUser';
import { test as serverTest } from '../../fixtures/serverUser';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { frontendBaseUrl } from '../../helpers/config';
import {
  cleanupServerTableFixture,
  createServerTableFixture,
  makeServerRoundDeliverable,
  type ServerTableFixture,
} from '../../seed/serverTableService';

const test = mergeTests(serverTest, cashierTest);
const PRODUCT = 'E2E Test Product';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface CreatedOrder {
  id: string;
  orderNumber: string;
}

const VIEWPORTS: readonly { name: string; viewport: ViewportSize }[] = [
  { name: 'phone', viewport: { width: 390, height: 844 } },
  { name: 'tablet', viewport: { width: 1024, height: 768 } },
];

async function requireResponseData<T>(page: Page, path: RegExp, action: () => Promise<void>): Promise<T> {
  const responsePromise = page.waitForResponse(
    (response) => path.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
  );
  await action();
  const response = await responsePromise;
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`Request ${path} failed (${response.status()}): ${body.message ?? 'missing response data'}`);
  }
  return body.data;
}

async function openServerContext(browser: Browser, storageState: string, viewport: ViewportSize) {
  const context = await browser.newContext({
    storageState,
    viewport,
    baseURL: frontendBaseUrl(),
  });
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('rumi_cookie_consent', JSON.stringify({ preferences: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  return { context, page };
}

for (const { name, viewport } of VIEWPORTS) {
  test(`server completes a table visit through cashier handoff on ${name}`, async ({
    browser,
    serverUser,
    cashierUser,
  }) => {
    test.setTimeout(120_000);
    let table: ServerTableFixture | undefined;
    const contexts: BrowserContext[] = [];

    try {
      table = await createServerTableFixture();
      const server = await openServerContext(browser, serverUser.storageStatePath, viewport);
      contexts.push(server.context);
      const cashier = await openServerContext(browser, cashierUser.storageStatePath, viewport);
      contexts.push(cashier.context);
      await server.page.goto('/server/floor');
      await server.page.getByTestId('server-floor-workspace').waitFor();
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

      await requireResponseData(server.page, /^\/api\/table-service-sessions$/, async () => {
        await server.page.getByRole('button', { name: 'Open Table' }).click();
      });
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

      await makeServerRoundDeliverable(created.id);
      await server.page.goto('/server/tasks');
      const task = server.page.getByTestId(`server-task-${created.id}`);
      await task.waitFor({ timeout: 20_000 });
      await expectNoA11yViolations(server.page);
      await task.getByRole('button', { name: `Deliver ${created.orderNumber}` }).click();
      await server.page.getByText('Task updated.').waitFor();

      await server.page.goto(`/server/tables/${table.tableId}`);
      await server.page.getByRole('button', { name: 'Send to Cashier' }).click();
      await server.page.getByText(/Cashier collection requested/).waitFor();
      await expectNoA11yViolations(server.page);

      await cashier.page.goto('/cashier/tables');
      await cashier.page.getByRole('button', { name: 'List' }).click();
      await cashier.page
        .getByRole('button', { name: new RegExp(`Open table .*${table.tableNumber}.*Payment requested`) })
        .click();
      await cashier.page.getByRole('heading', { level: 2, name: table.tableNumber }).waitFor();
      await expectNoA11yViolations(cashier.page);
      await cashier.page.getByRole('button', { name: 'Exact' }).click();
      await requireResponseData(cashier.page, /\/api\/table-service-sessions\/[^/]+\/payments$/, async () => {
        await cashier.page.getByRole('button', { name: 'Record payment' }).click();
      });

      await server.page.getByRole('button', { name: 'Refresh', exact: true }).click();
      const closeVisit = server.page.getByRole('button', { name: 'Close visit' }).first();
      await closeVisit.waitFor();
      await closeVisit.click();
      const modal = server.page.getByRole('dialog');
      await modal.getByRole('button', { name: 'Close visit' }).click();
      await server.page.getByRole('button', { name: 'Open Table' }).waitFor({ timeout: 20_000 });
      await expectNoA11yViolations(server.page);
    } finally {
      await Promise.allSettled(contexts.map((context) => context.close()));
      if (table) await cleanupServerTableFixture(table.tableId);
    }
  });
}
