import { expect, type Page } from '@playwright/test';
import type { TableAccountP11Fixture } from '../../seed/tableAccountP11';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readGuestParticipantToken(page: Page): Promise<string> {
  const stored = await page.evaluate(() => sessionStorage.getItem('rumi_table_guest_visit_v1'));
  const state: unknown = JSON.parse(stored ?? '{}');
  if (!isRecord(state) || typeof state.participantToken !== 'string' || !state.participantToken) {
    throw new Error('The guest visit did not retain its participant credential.');
  }
  return state.participantToken;
}

/** A real public scan must join the expected visit with a QR-only payload. */
export async function joinGuestByQr(
  page: Page,
  table: Pick<TableAccountP11Fixture, 'qrCodeData'>,
  serviceSessionId: string,
): Promise<string> {
  const joined = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/table-guest-visits/join' && response.request().method() === 'POST',
  );
  await page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
  const response = await joined;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ qrCodeData: table.qrCodeData });
  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    body.success !== true ||
    !isRecord(body.data) ||
    typeof body.data.serviceSessionId !== 'string'
  ) {
    throw new Error('The public QR join did not return a successful visit binding.');
  }
  expect(body.data.serviceSessionId.toLowerCase()).toBe(serviceSessionId.toLowerCase());
  await expect(page).toHaveURL(/\/en\/menu$/);
  return readGuestParticipantToken(page);
}

/** Positive control: the new participant reads this exact endpoint; the old token cannot. */
export async function expectOldGuestDenied(page: Page, serviceSessionId: string, oldToken: string): Promise<void> {
  const accountRead = page.waitForResponse(
    (response) =>
      [
        `/api/table-guest-visits/${serviceSessionId}/account`,
        `/api/table-guest-visits/${serviceSessionId}/account-payments`,
      ].some((path) => path.toLowerCase() === new URL(response.url()).pathname.toLowerCase()) &&
      response.request().method() === 'GET',
  );
  await page.goto('/en/table-account');
  const current = await accountRead;
  expect(current.status()).toBe(200);
  const denied = await page.request.get(current.url(), { headers: { 'X-Table-Participant': oldToken } });
  expect(denied.status()).toBe(404);
  const body: unknown = await denied.json();
  if (!isRecord(body) || body.success !== false) {
    throw new Error('The old participant did not receive the expected unavailable response.');
  }
  await page.goto('/en/menu');
}
