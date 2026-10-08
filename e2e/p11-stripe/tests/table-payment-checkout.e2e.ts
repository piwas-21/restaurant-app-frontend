import { expect, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../../p11/staffUsers';
import { createTableAccountP11Fixture } from '../../seed/tableAccountP11';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { apiBaseUrl } from '../../helpers/config';
import { closeDbPool } from '../../helpers/db';
import { addThreeUnitRound, joinVisit, openTableVisit, openVisitContext, responseData } from '../tableVisit';
import { completeContribution, type PaymentChoice } from '../paymentCheckout';
import { retainPaymentEvidence } from '../paymentEvidence';
import { retainRefundEvidence } from '../refundEvidence';
import { retainGuestStorageDiagnostics, type GuestStorageDiagnostic } from '../guestStorageDiagnostics';
import type { AccountPaymentAccount } from '../../../src/types/accountPaymentAccount';
import type { AccountPaymentOperation } from '../../../src/types/accountPayments';
import type { GuestAccountPaymentOperation } from '../../../src/types/guestAccountPayments';

async function readAccountAfter(page: Page, sessionId: string, action: () => Promise<unknown>) {
  const accountPath = `/api/table-service-sessions/${encodeURIComponent(sessionId)}/account-payments`;
  const pending = page.waitForResponse(
    (response) => response.request().method() === 'GET' && new URL(response.url()).pathname === accountPath,
  );
  await action();
  const response = await pending;
  const body = (await response.json()) as { success: boolean; data?: AccountPaymentAccount };
  if (!response.ok() || body.success !== true || !body.data) {
    throw new Error(`Cashier account refresh failed with HTTP ${response.status()}.`);
  }
  expect(body.data.serviceSessionId.toLowerCase()).toBe(sessionId.toLowerCase());
  return body.data;
}

async function readGuestParticipantToken(page: Page, expectedSessionId: string) {
  return page.evaluate((expectedId) => {
    const raw = window.sessionStorage.getItem('rumi_table_guest_visit_v1');
    if (!raw) throw new Error('The active guest visit identity is unavailable.');
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error('The active guest visit identity is invalid.');
    }
    if (typeof value !== 'object' || value === null) throw new Error('The active guest visit identity is invalid.');
    const identity = value as { serviceSessionId?: unknown; participantToken?: unknown };
    if (
      identity.serviceSessionId !== expectedId ||
      typeof identity.participantToken !== 'string' ||
      identity.participantToken.length < 32
    )
      throw new Error('The active guest visit identity does not match this table visit.');
    return identity.participantToken;
  }, expectedSessionId);
}

test('four phones settle one table through items, amount and equal shares, then linked refunds', async ({
  browser,
  baseURL,
  p11Admin,
  p11Cashier,
  p11Server,
}) => {
  if (!baseURL) throw new Error('The dedicated local UI origin is unavailable.');
  const contexts: BrowserContext[] = [];
  const guestStorageDiagnostics: GuestStorageDiagnostic[] = [];
  try {
    const table = await createTableAccountP11Fixture(p11Admin.accessToken);
    const server = await openVisitContext(browser, baseURL, p11Server);
    contexts.push(server.context);
    const visit = await openTableVisit(server.page, table);
    const orderId = await addThreeUnitRound(server.page, table.tableId, visit.sessionId);
    const cashier = await openVisitContext(browser, baseURL, p11Cashier);
    contexts.push(cashier.context);
    await cashier.page.goto(`/en/cashier/tables?session=${encodeURIComponent(visit.sessionId)}`);
    const cashierCollection = cashier.page.getByRole('region', { name: 'Collect a contribution', exact: true });
    await expect(cashierCollection).toBeVisible();
    const choices: readonly [PaymentChoice, number][] = [
      ['Items', 1500],
      ['Amount', 501],
      ['EqualFirst', 1250],
      ['EqualSecond', 1249],
    ];
    const attempts: Awaited<ReturnType<typeof completeContribution>>[] = [];
    let cashierOperationId: string | null = null;
    let releasedCashierOperationId: string | null = null;
    for (const [choice, amountMinor] of choices) {
      const guest = await openVisitContext(browser, baseURL);
      contexts.push(guest.context);
      await joinVisit(guest.page, table, visit.code);
      const guestParticipantToken =
        choice === 'Items' ? await readGuestParticipantToken(guest.page, visit.sessionId) : null;
      if (choice === 'Items') await expectNoA11yViolations(guest.page);
      attempts.push(
        await completeContribution(
          guest.page,
          choice,
          amountMinor,
          choice === 'Items'
            ? {
                expectedAppOrigin: new URL(baseURL).origin,
                onStorageDiagnostic: (snapshot) => {
                  guestStorageDiagnostics.push(snapshot);
                },
                afterQuote: async (guestOperation) => {
                  const account = await readAccountAfter(cashier.page, visit.sessionId, () => cashier.page.reload());
                  expect(account.availableMinor).toBeGreaterThanOrEqual(amountMinor);
                  const cashierMode = cashierCollection.getByRole('combobox', {
                    name: /^Collect a contribution\b/,
                  });
                  await expect(cashierMode).toHaveCount(1);
                  await expect(cashierMode.locator('option[value="Items"]')).toHaveCount(1);
                  await cashierMode.selectOption('Items');
                  await cashierCollection
                    .getByRole('group', { name: 'Selected items' })
                    .getByRole('spinbutton')
                    .first()
                    .fill('1');
                  const cashierQuote = await responseData<AccountPaymentOperation>(
                    cashier.page,
                    /\/account-payments\/quotes$/,
                    () => cashierCollection.getByRole('button', { name: 'Review contribution', exact: true }).click(),
                  );
                  expect(cashierQuote).toMatchObject({
                    amountMinor,
                    currency: 'CHF',
                    mode: 'Items',
                    paymentMethod: 'Cash',
                    state: 'Quoted',
                  });
                  expect(cashierQuote.allocations).toEqual(guestOperation.allocations);
                  cashierOperationId = cashierQuote.operationId;
                },
                afterCheckout: async (guestOperation, _checkout) => {
                  const account = await readAccountAfter(cashier.page, visit.sessionId, () => cashier.page.reload());
                  expect(account.reservedMinor).toBe(amountMinor);
                  expect(account.capturedAccountPaymentMinor).toBe(0);
                  expect(account.activeAttempts).toHaveLength(1);
                  const foreignReservation = account.activeAttempts[0];
                  expect(foreignReservation).toMatchObject({
                    operationId: null,
                    isOwnOperation: false,
                    paymentMethod: 'OnlinePayment',
                    amountMinor,
                    currency: 'CHF',
                  });
                  expect(['Starting', 'Processing']).toContain(foreignReservation.state);

                  if (!guestParticipantToken) throw new Error('The guest participant credential was not captured.');
                  const participantApi = await apiRequest.newContext({
                    baseURL: apiBaseUrl(),
                    extraHTTPHeaders: { 'X-Table-Participant': guestParticipantToken },
                  });
                  try {
                    const operationPath =
                      `/api/table-guest-visits/${encodeURIComponent(visit.sessionId)}` +
                      `/account-payments/operations/${encodeURIComponent(guestOperation.operationId)}`;
                    const guestResponse = await participantApi.get(operationPath);
                    const guestBody = (await guestResponse.json()) as {
                      success?: boolean;
                      data?: GuestAccountPaymentOperation;
                    };
                    if (!guestResponse.ok() || guestBody.success !== true || !guestBody.data)
                      throw new Error(`Guest operation readback failed with HTTP ${guestResponse.status()}.`);
                    expect(guestBody.data).toMatchObject({
                      serviceSessionId: visit.sessionId,
                      operationId: guestOperation.operationId,
                      mode: 'Items',
                      paymentMethod: 'OnlinePayment',
                      amountMinor,
                      currency: 'CHF',
                    });
                    expect(['Starting', 'Processing']).toContain(guestBody.data.state);
                  } finally {
                    await participantApi.dispose();
                  }
                  if (!cashierOperationId) throw new Error('The cashier contribution was not quoted before checkout.');
                  const review = cashier.page.getByRole('region', { name: 'Review contribution', exact: true });
                  const reserveResponse = cashier.page.waitForResponse(
                    (value) =>
                      value.request().method() === 'POST' &&
                      new URL(value.url()).pathname.endsWith(`/operations/${cashierOperationId}/reserve`),
                  );
                  await review.getByRole('button', { name: 'Confirm reviewed contribution', exact: true }).click();
                  const refused = await reserveResponse;
                  expect(refused.status()).toBe(409);
                  const refusalBody = (await refused.json()) as { success?: boolean };
                  expect(refusalBody.success).toBe(false);

                  await review
                    .getByLabel('I confirm no money was collected for this contribution.', { exact: true })
                    .check();
                  const release = await responseData<AccountPaymentOperation>(
                    cashier.page,
                    new RegExp(`/operations/${cashierOperationId}/release$`),
                    () => review.getByRole('button', { name: 'Release this contribution', exact: true }).click(),
                  );
                  expect(release.state).toBe('Released');
                  releasedCashierOperationId = cashierOperationId;
                  const afterRelease = await readAccountAfter(cashier.page, visit.sessionId, () =>
                    cashierCollection.getByRole('button', { name: 'Refresh', exact: true }).click(),
                  );
                  expect(afterRelease.reservedMinor).toBe(amountMinor);
                  expect(afterRelease.capturedAccountPaymentMinor).toBe(0);
                },
              }
            : undefined,
        ),
      );
      if (choice === 'Items') {
        const afterPhoneCapture = await readAccountAfter(cashier.page, visit.sessionId, () =>
          cashierCollection.getByRole('button', { name: 'Refresh', exact: true }).click(),
        );
        expect(afterPhoneCapture.reservedMinor).toBe(0);
        expect(afterPhoneCapture.capturedAccountPaymentMinor).toBe(amountMinor);
        expect(afterPhoneCapture.activeAttempts.every((attempt) => attempt.operationId !== cashierOperationId)).toBe(
          true,
        );
      }
      if (!releasedCashierOperationId) throw new Error('The released cashier attempt was not recorded.');
      await retainPaymentEvidence(visit.sessionId, attempts, false, releasedCashierOperationId);
    }
    if (!releasedCashierOperationId) throw new Error('The released cashier attempt was not recorded.');
    const expectedReleasedCashierOperationId = releasedCashierOperationId;
    expect(new Set(attempts.map((value) => value.attemptId)).size).toBe(4);
    expect(attempts.reduce((sum, value) => sum + value.amountMinor, 0)).toBe(4500);

    const admin = await openVisitContext(browser, baseURL, p11Admin);
    contexts.push(admin.context);
    await admin.page.goto(`/en/server/orders/${orderId}`);
    await admin.page.getByRole('button', { name: 'Amend order', exact: true }).click();
    const amendment = admin.page.getByRole('dialog');
    await amendment.getByRole('combobox', { name: 'Change this line', exact: true }).selectOption('Void');
    await amendment.getByRole('spinbutton', { name: 'Units', exact: true }).fill('3');
    await amendment.getByLabel('Reason for this change').fill('Refund isolated Stripe acceptance contributions.');
    await responseData(admin.page, new RegExp(`^/api/staff/orders/${orderId}/amendments/quote$`), () =>
      amendment.getByRole('button', { name: 'Get a quote', exact: true }).click(),
    );
    const committed = await responseData<{
      amendmentId: string;
      clientOperationId: string;
      sourceOrderId: string;
    }>(admin.page, new RegExp(`^/api/staff/orders/${orderId}/amendments/commit$`), () =>
      amendment.getByRole('button', { name: 'Confirm amendment', exact: true }).click(),
    );
    expect(committed.sourceOrderId).toBe(orderId);
    await expect(amendment.getByRole('status')).toHaveText(`Amendment committed · ${committed.clientOperationId}`);
    const closeAmendment = amendment.getByRole('button').filter({ hasText: /^Close$/ });
    await expect(closeAmendment).toHaveCount(1);
    await closeAmendment.click();
    await admin.page.reload();
    await admin.page.getByRole('button', { name: 'Resolve payment correction', exact: true }).click();
    const correction = admin.page.getByRole('dialog', { name: 'Payment correction', exact: true });
    const quote = await responseData<{ refundMinor: number; refundLegs: readonly { amountMinor: number }[] }>(
      admin.page,
      /\/financial-resolution\/quote$/,
      () => correction.getByRole('button', { name: 'Review correction', exact: true }).click(),
    );
    expect(quote.refundMinor).toBe(4500);
    expect(quote.refundLegs.map((value) => value.amountMinor).sort((a, b) => a - b)).toEqual([501, 1249, 1250, 1500]);
    await correction.getByLabel('I approve these refund and credit amounts.', { exact: true }).check();
    await responseData(admin.page, /\/financial-resolution$/, () =>
      correction.getByRole('button', { name: 'Confirm correction', exact: true }).click(),
    );
    await expect(correction.getByText('Correction resolved', { exact: true })).toBeVisible({ timeout: 120_000 });
    await expect
      .poll(
        async () => {
          try {
            const captured = await retainPaymentEvidence(
              visit.sessionId,
              attempts,
              true,
              expectedReleasedCashierOperationId,
            );
            await retainRefundEvidence(visit.sessionId, orderId, committed.amendmentId, captured);
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 120_000 },
      )
      .toBe(true);
  } finally {
    try {
      retainGuestStorageDiagnostics(guestStorageDiagnostics);
    } finally {
      for (const context of contexts) await context.close();
      await closeDbPool();
    }
  }
});
