import { expect, type Page } from '@playwright/test';

export async function openStaffVisit(page: Page, tableId: string) {
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/table-service-sessions' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add order', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    readonly success: boolean;
    readonly data: { readonly serviceSessionId: string; readonly status: string };
  };
  expect(body.success).toBe(true);
  expect(body.data.status).toBe('Open');
  await expect(page).toHaveURL(new RegExp(`/server/tables/${tableId}/order\\?`));
  await page.goto(`/en/server/tables/${encodeURIComponent(tableId)}`);
  return body.data;
}
