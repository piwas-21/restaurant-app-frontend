import { randomUUID } from 'node:crypto';
import { expect, request, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { apiBaseUrl } from '../../helpers/config';
import { test } from '../../p11/staffUsers';
import { createTableAccountP11Fixture } from '../../seed/tableAccountP11';
import { closeDbPool } from '../../helpers/db';
import { addSingleUnitRound, joinVisit, openTableVisit, openVisitContext, responseData } from '../tableVisit';
import { completeContribution } from '../paymentCheckout';
import { retainMixedTenderEvidence } from '../mixedTenderEvidence';
import { openPaymentCorrectionDialog } from '../paymentCorrection';
import { acknowledgeCorrectionWork, readNativeKitchenSnapshot } from '../../p11/helpers/nativeKitchenAcceptance';
import type { AccountPaymentAccount } from '../../../src/types/accountPaymentAccount';
import type { GuestAccountPaymentAccount } from '../../../src/types/guestAccountPaymentAccount';
import type { AccountPaymentAllocation, AccountPaymentOperation } from '../../../src/types/accountPayments';
import type { AmendmentResolutionQuote, AmendmentResolutionResult } from '../../../src/types/amendmentResolution';

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

function orderRowForNumber(page: Page, orderNumber: string) {
  return page.getByRole('row').filter({ has: page.getByText(orderNumber, { exact: true }) });
}

function orderUpdatedSuccessToast(page: Page) {
  return page.getByRole('alert').filter({ hasText: /^Order updated successfully$/ });
}

async function readApiData<T>(response: P11Response, label: string): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`P11 ${label} was refused with HTTP ${response.status()}.`);
  }
  return body.data;
}

async function cancelSourceOrderInAdminUi(page: Page, orderId: string, orderNumber: string): Promise<void> {
  await page.goto('/en/admin/orders-management');
  const search = page.getByPlaceholder('Search by order number, customer name, email, or phone...', { exact: true });
  await search.fill(orderNumber);
  const row = page.getByRole('row').filter({ hasText: orderNumber });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'View Details', exact: true }).click();

  await page.getByRole('button', { name: 'Cancel Order', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Cancel Order', exact: true });
  await confirmation
    .getByLabel('Cancellation Reason *', { exact: true })
    .fill('P11 mixed tender source was fully refunded before service.');
  const cancelledResponse = page.waitForResponse((response) => {
    const path = `/api/Orders/${encodeURIComponent(orderId)}/cancel`;
    return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
  });
  await confirmation.getByRole('button', { name: 'Cancel Order', exact: true }).click();
  const cancelled = await readApiData<{ readonly id: string; readonly status: string }>(
    await cancelledResponse,
    'source order cancellation',
  );
  expect(cancelled).toMatchObject({ id: orderId, status: 'Cancelled' });

  const successToast = orderUpdatedSuccessToast(page);
  await expect(successToast).toHaveCount(1);
  await expect(successToast).toBeVisible();

  const cancelledRow = orderRowForNumber(page, orderNumber);
  await expect(cancelledRow).toHaveCount(1);
  await expect(cancelledRow.getByRole('cell', { name: 'Cancelled', exact: true })).toBeVisible();
}

async function readAccountAfter(page: Page, sessionId: string, action: () => Promise<unknown>) {
  const accountPath = `/api/table-service-sessions/${encodeURIComponent(sessionId)}/account-payments`;
  const pending = page.waitForResponse(
    (response) => response.request().method() === 'GET' && new URL(response.url()).pathname === accountPath,
  );
  await action();
  const response = await pending;
  const body = (await response.json()) as { success: boolean; data?: AccountPaymentAccount };
  if (!response.ok() || body.success !== true || !body.data)
    throw new Error(`Cashier account refresh failed with HTTP ${response.status()}.`);
  expect(body.data.serviceSessionId.toLowerCase()).toBe(sessionId.toLowerCase());
  return body.data;
}

test('mixed tender refunds resolve the kitchen correction before closing and resetting the visit', async ({
  browser,
  baseURL,
  p11Admin,
  p11Cashier,
  p11Server,
}) => {
  if (!baseURL) throw new Error('The dedicated local UI origin is unavailable.');
  const contexts: BrowserContext[] = [];
  let api: APIRequestContext | undefined;
  try {
    const table = await createTableAccountP11Fixture(p11Admin.accessToken);
    api = await request.newContext({
      baseURL: apiBaseUrl(),
      extraHTTPHeaders: { Authorization: `Bearer ${p11Admin.accessToken}` },
    });
    const server = await openVisitContext(browser, baseURL, p11Server);
    contexts.push(server.context);
    const visit = await openTableVisit(server.page, table);
    const orderId = await addSingleUnitRound(server.page, table.tableId, visit.sessionId);

    const cashier = await openVisitContext(browser, baseURL, p11Cashier);
    contexts.push(cashier.context);
    await cashier.page.goto(`/en/cashier/tables?session=${encodeURIComponent(visit.sessionId)}`);
    const collection = cashier.page.getByRole('region', { name: 'Collect a contribution', exact: true });
    await expect(collection).toBeVisible();

    const guest = await openVisitContext(browser, baseURL);
    contexts.push(guest.context);
    await joinVisit(guest.page, table, visit.code);
    await expectNoA11yViolations(guest.page);
    let onlineAllocations: readonly AccountPaymentAllocation[] = [];
    const online = await completeContribution(guest.page, 'Amount', 501, {
      afterQuote: async (operation) => {
        onlineAllocations = operation.allocations;
      },
    });
    expect(onlineAllocations).toHaveLength(1);
    const afterOnline = await readAccountAfter(cashier.page, visit.sessionId, () => cashier.page.reload());
    expect(afterOnline).toMatchObject({ outstandingMinor: 999, reservedMinor: 0, availableMinor: 999 });
    expect(afterOnline.capturedAccountPaymentMinor).toBe(501);

    const selection = collection.locator('form').first();
    await selection.getByRole('radio', { name: 'Custom amount', exact: true }).check();
    await selection.getByLabel('Contribution amount', { exact: true }).fill('9.99');
    const reserveResponsePromise = cashier.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /^\/api\/table-service-sessions\/[^/]+\/account-payments\/operations\/[^/]+\/reserve$/i.test(
          new URL(response.url()).pathname,
        ),
    );
    const cashQuote = await responseData<AccountPaymentOperation>(cashier.page, /\/account-payments\/quotes$/, () =>
      selection.getByRole('button', { name: 'Review contribution', exact: true }).click(),
    );
    expect(cashQuote).toMatchObject({
      amountMinor: 999,
      currency: 'CHF',
      mode: 'Amount',
      paymentMethod: 'Cash',
      state: 'Quoted',
    });
    const reserveResponse = await reserveResponsePromise;
    const reserve = await readApiData<AccountPaymentOperation>(reserveResponse, 'cash account auto-reservation');
    expect(new URL(reserveResponse.url()).pathname.toLowerCase()).toBe(
      `/api/table-service-sessions/${visit.sessionId}/account-payments/operations/${cashQuote.operationId}/reserve`.toLowerCase(),
    );
    expect(reserveResponse.request().postDataJSON()).toMatchObject({
      expectedVersion: cashQuote.version,
      expectedAccountRevision: cashQuote.expectedAccountRevision,
    });
    expect(reserve).toMatchObject({ operationId: cashQuote.operationId, state: 'Reserved' });
    expect(cashQuote.allocations).toHaveLength(1);
    expect(online.operationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(online.attemptId).toMatch(/^[a-f0-9-]{36}$/);
    const allocationIdentity = ({
      orderId: sourceOrderId,
      orderItemId,
      startOrdinal,
      unitCount,
    }: AccountPaymentAllocation) => ({
      orderId: sourceOrderId,
      orderItemId,
      startOrdinal,
      unitCount,
    });
    expect(allocationIdentity(cashQuote.allocations[0])).toEqual(allocationIdentity(onlineAllocations[0]));
    expect(cashQuote.allocations[0].amountMinor).toBe(999);
    expect(onlineAllocations[0].amountMinor).toBe(501);
    expect(cashQuote.allocations[0].amountMinor + onlineAllocations[0].amountMinor).toBe(1500);
    expect(onlineAllocations[0]).toMatchObject({ startOrdinal: 1, unitCount: 1, minorPerUnit: 501 });
    expect(cashQuote.allocations[0]).toMatchObject({
      orderItemId: expect.any(String),
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 999,
    });

    const cashReview = collection.getByRole('region', { name: 'Review contribution', exact: true });
    await cashReview.getByLabel('Cash received', { exact: true }).fill('10.00');
    await expect(cashReview.getByRole('button', { name: 'Record cash received', exact: true })).toBeEnabled();
    const cashCapture = await responseData<AccountPaymentOperation>(
      cashier.page,
      new RegExp(`/operations/${cashQuote.operationId}/collect$`),
      () => cashReview.getByRole('button', { name: 'Record cash received', exact: true }).click(),
    );
    expect(cashCapture.state).toBe('Captured');

    const settled = await readAccountAfter(cashier.page, visit.sessionId, () =>
      collection.getByRole('button', { name: 'Refresh', exact: true }).click(),
    );
    expect(settled).toMatchObject({ outstandingMinor: 0, reservedMinor: 0, availableMinor: 0 });
    expect(settled.capturedAccountPaymentMinor).toBe(1500);

    const sourceOrder = await readApiData<{
      readonly id: string;
      readonly orderNumber: string;
      readonly version: number;
    }>(await api.get(`/api/Orders/${encodeURIComponent(orderId)}`), 'mixed-tender source order');
    expect(sourceOrder).toMatchObject({ id: orderId });
    expect(sourceOrder.orderNumber).toBeTruthy();
    expect(sourceOrder.version).toBeGreaterThan(0);
    const admin = await openVisitContext(browser, baseURL, p11Admin);
    contexts.push(admin.context);
    await admin.page.goto(`/en/server/orders/${orderId}`);
    await admin.page.getByRole('button', { name: 'Amend order', exact: true }).click();
    const amendmentForm = admin.page.getByRole('dialog');
    await amendmentForm.getByRole('combobox', { name: 'Change this line', exact: true }).selectOption('Void');
    await amendmentForm.getByRole('spinbutton', { name: 'Units', exact: true }).fill('1');
    await amendmentForm.getByLabel('Reason for this change').fill('P11 mixed tender acceptance refund.');
    await responseData(admin.page, new RegExp(`^/api/staff/orders/${orderId}/amendments/quote$`), () =>
      amendmentForm.getByRole('button', { name: 'Get a quote', exact: true }).click(),
    );
    const amendment = await responseData<{
      amendmentId: string;
      clientOperationId: string;
      sourceOrderId: string;
    }>(admin.page, new RegExp(`^/api/staff/orders/${orderId}/amendments/commit$`), () =>
      amendmentForm.getByRole('button', { name: 'Confirm amendment', exact: true }).click(),
    );
    expect(amendment.sourceOrderId).toBe(orderId);
    await expect(amendmentForm.getByRole('status')).toHaveText(`Amendment committed · ${amendment.clientOperationId}`);
    const closeAmendment = amendmentForm.getByRole('button').filter({ hasText: /^Close$/ });
    await expect(closeAmendment).toHaveCount(1);
    await closeAmendment.click();
    const correction = await openPaymentCorrectionDialog(admin.page);
    const quote = await responseData<AmendmentResolutionQuote>(admin.page, /\/financial-resolution\/quote$/, () =>
      correction.getByRole('button', { name: 'Review correction', exact: true }).click(),
    );
    expect(quote).toMatchObject({ currency: 'CHF', creditMinor: 1500, refundMinor: 1500, unpaidWaivedMinor: 0 });
    expect(quote.refundLegs.map(({ custody, amountMinor }) => [custody, amountMinor]).sort()).toEqual([
      ['ManualTill', 999],
      ['StripeDirect', 501],
    ]);
    expect(quote.refundLegs.find((leg) => leg.custody === 'ManualTill')?.cashRefund).toMatchObject({
      exactRefundAmountMinor: 999,
      refundAdjustmentMinor: 1,
      cashRefundAmountMinor: 1000,
    });
    expect(quote.refundLegs.find((leg) => leg.custody === 'StripeDirect')?.cashRefund).toBeNull();
    await correction.getByLabel('I approve these refund and credit amounts.', { exact: true }).check();
    await responseData<AmendmentResolutionResult>(admin.page, /\/financial-resolution$/, () =>
      correction.getByRole('button', { name: 'Confirm correction', exact: true }).click(),
    );

    const cashRefundReference = `P11-MIXED-${randomUUID().slice(0, 8)}`;
    const cashReturnForm = correction.locator('form').last();
    await expect(cashReturnForm.getByRole('textbox')).toHaveCount(1);
    await cashReturnForm.getByRole('textbox').fill(cashRefundReference);
    await expect(cashReturnForm.getByRole('checkbox')).toHaveCount(2);
    await cashReturnForm.getByRole('checkbox').nth(0).check();
    await cashReturnForm.getByRole('checkbox').nth(1).check();
    await responseData<AmendmentResolutionResult>(admin.page, /\/confirm-till$/, () =>
      cashReturnForm.getByRole('button', { name: 'Record till refunds', exact: true }).click(),
    );
    await expect(correction.getByText('Correction resolved', { exact: true })).toBeVisible({ timeout: 120_000 });

    await cancelSourceOrderInAdminUi(admin.page, orderId, sourceOrder.orderNumber);

    // This is deliberately after the last financial/source-order mutation and before the visit reset.
    await retainMixedTenderEvidence(visit.sessionId, orderId, amendment.amendmentId, {
      onlineOperationId: online.operationId,
      cashOperationId: cashQuote.operationId,
    });

    await admin.page.setViewportSize({ width: 1024, height: 768 });
    await admin.page.goto('/en/kitchen-staff');
    await expect(admin.page.getByRole('heading', { name: 'Kitchen work', exact: true })).toBeVisible();
    const kitchen = await readNativeKitchenSnapshot(api);
    const terminalCorrection = kitchen.corrections.find((item) => item.orderId.toLowerCase() === orderId.toLowerCase());
    if (!terminalCorrection)
      throw new Error('The cancelled source order correction was absent from the kitchen board.');
    expect(terminalCorrection).toMatchObject({
      orderId,
      orderNumber: sourceOrder.orderNumber,
      status: 'Cancelled',
      amendmentId: amendment.amendmentId,
      withdrawn: false,
      isCompleted: false,
      canComplete: true,
    });
    expect(terminalCorrection.orderVersion).toBeGreaterThan(0);
    expect(terminalCorrection.accountRevision).toBeGreaterThan(0);
    expect(terminalCorrection.changes.map(({ kind }) => kind)).toContain('Void');

    await server.page.goto(`/en/server/tables/${encodeURIComponent(table.tableId)}`);
    await server.page.reload();
    const blockedClose = server.page.getByRole('button', { name: 'Close visit', exact: true });
    await expect(blockedClose).toBeEnabled();
    await blockedClose.click();
    const closeDialog = server.page.getByRole('dialog');
    const blockedCloseResponse = server.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/table-service-sessions/${encodeURIComponent(visit.sessionId)}/close` &&
        response.request().method() === 'POST',
    );
    await closeDialog.getByRole('button', { name: 'Close visit', exact: true }).click();
    const closeRefusal = await blockedCloseResponse;
    expect(closeRefusal.ok()).toBe(true);
    expect(await closeRefusal.json()).toMatchObject({ success: false, errorCode: 'KitchenCorrectionUnresolved' });
    await expect(
      server.page
        .getByRole('alert')
        .filter({ hasText: 'Acknowledge the kitchen correction before closing this visit.' }),
    ).toBeVisible();

    await acknowledgeCorrectionWork(admin.page, terminalCorrection);
    const completedKitchen = await readNativeKitchenSnapshot(api);
    expect(completedKitchen.corrections.some((item) => item.workItemId === terminalCorrection.workItemId)).toBe(false);

    await server.page.reload();
    const closeVisit = server.page.getByRole('button', { name: 'Close visit', exact: true });
    await expect(closeVisit).toBeEnabled();
    await closeVisit.click();
    const finalCloseDialog = server.page.getByRole('dialog');
    const closed = await responseData<OpenSession>(
      server.page,
      new RegExp(`^/api/table-service-sessions/${visit.sessionId}/close$`),
      () => finalCloseDialog.getByRole('button', { name: 'Close visit', exact: true }).click(),
    );
    expect(closed).toMatchObject({ serviceSessionId: visit.sessionId, status: 'Closed' });

    const nextVisit = await openTableVisit(server.page, table);
    expect(nextVisit.sessionId.toLowerCase()).not.toBe(visit.sessionId.toLowerCase());
    expect(nextVisit.code).not.toBe(visit.code);
    const nextGuest = await openVisitContext(browser, baseURL);
    contexts.push(nextGuest.context);
    await nextGuest.page.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
    await expect(nextGuest.page.getByRole('heading', { name: 'Join this table visit', exact: true })).toBeVisible();
    const codeInput = nextGuest.page.getByLabel('Table visit code', { exact: true });
    await codeInput.fill(visit.code);
    await nextGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
    await expect(nextGuest.page.getByRole('alert').filter({ hasText: 'We could not join this visit' })).toBeVisible();
    await codeInput.fill(nextVisit.code);
    await nextGuest.page.getByRole('button', { name: 'Join table', exact: true }).click();
    await expect(nextGuest.page).toHaveURL(/\/en\/menu$/);

    const guestAccountPath = `/api/table-guest-visits/${encodeURIComponent(nextVisit.sessionId)}/account-payments`;
    const guestAccountResponse = nextGuest.page.waitForResponse(
      (response) => new URL(response.url()).pathname === guestAccountPath && response.request().method() === 'GET',
    );
    await nextGuest.page.goto('/en/table-account');
    const accountResponse = await guestAccountResponse;
    expect(accountResponse.request().headers()['x-table-participant']).toBeTruthy();
    const nextAccount = await readApiData<GuestAccountPaymentAccount>(accountResponse, 'fresh guest account');
    await expect(nextGuest.page.getByRole('heading', { name: 'Table account', exact: true })).toBeVisible();
    expect(nextAccount).toMatchObject({
      serviceSessionId: nextVisit.sessionId,
      status: 'Open',
      currency: 'CHF',
      outstandingMinor: 0,
      reservedMinor: 0,
      availableMinor: 0,
      capturedAccountPaymentMinor: 0,
      outstandingAllocations: [],
      availableAllocations: [],
      activeEqualSharePlan: null,
      activeAttempts: [],
    });
    await expect(nextGuest.page.locator('dl[aria-label="Table account totals"]')).toContainText('CHF 0.00');
  } finally {
    for (const context of contexts) await context.close();
    await api?.dispose();
    await closeDbPool();
  }
});
