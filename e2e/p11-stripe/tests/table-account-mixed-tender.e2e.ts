import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { expectNoA11yViolations } from '../../helpers/a11y';
import { test } from '../../p11/staffUsers';
import { createTableAccountP11Fixture } from '../../seed/tableAccountP11';
import { closeDbPool } from '../../helpers/db';
import { addSingleUnitRound, joinVisit, openTableVisit, openVisitContext, responseData } from '../tableVisit';
import { completeContribution } from '../paymentCheckout';
import { retainMixedTenderEvidence } from '../mixedTenderEvidence';
import type { AccountPaymentAccount } from '../../../src/types/accountPaymentAccount';
import type { AccountPaymentAllocation, AccountPaymentOperation } from '../../../src/types/accountPayments';
import type { AmendmentResolutionQuote, AmendmentResolutionResult } from '../../../src/types/amendmentResolution';

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

test('mixed online and cash collection refunds the same CHF unit through both custodians', async ({
  browser,
  baseURL,
  p11Admin,
  p11Cashier,
  p11Server,
}) => {
  if (!baseURL) throw new Error('The dedicated local UI origin is unavailable.');
  const contexts: BrowserContext[] = [];
  try {
    const table = await createTableAccountP11Fixture(p11Admin.accessToken);
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
    await selection.getByLabel('Collect a contribution', { exact: true }).selectOption('Amount');
    await selection.getByLabel('Contribution amount', { exact: true }).fill('9.99');
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
    expect(cashQuote.allocations).toHaveLength(1);
    expect(online.operationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(online.attemptId).toMatch(/^[a-f0-9-]{36}$/);
    const allocationIdentity = ({
      orderId: sourceOrderId,
      orderItemId,
      startOrdinal,
      unitCount,
      minorPerUnit,
    }: AccountPaymentAllocation) => ({
      orderId: sourceOrderId,
      orderItemId,
      startOrdinal,
      unitCount,
      minorPerUnit,
    });
    expect(allocationIdentity(cashQuote.allocations[0])).toEqual(allocationIdentity(onlineAllocations[0]));
    expect(cashQuote.allocations[0].amountMinor).toBe(999);
    expect(onlineAllocations[0].amountMinor).toBe(501);
    expect(cashQuote.allocations[0]).toMatchObject({
      orderItemId: expect.any(String),
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 1500,
    });

    const cashReview = collection.getByRole('region', { name: 'Review contribution', exact: true });
    const reserve = responseData<AccountPaymentOperation>(
      cashier.page,
      new RegExp(`/operations/${cashQuote.operationId}/reserve$`),
      () => cashReview.getByRole('button', { name: 'Confirm reviewed contribution', exact: true }).click(),
    );
    expect((await reserve).state).toBe('Reserved');
    await cashReview.getByLabel('Cash received', { exact: true }).fill('10.00');
    await cashReview
      .getByLabel('I have received this cash or confirmed this card payment on the separate terminal.', { exact: true })
      .check();
    const cashCapture = await responseData<AccountPaymentOperation>(
      cashier.page,
      new RegExp(`/operations/${cashQuote.operationId}/collect$`),
      () => cashReview.getByRole('button', { name: 'Record confirmed payment', exact: true }).click(),
    );
    expect(cashCapture.state).toBe('Captured');

    const settled = await readAccountAfter(cashier.page, visit.sessionId, () =>
      collection.getByRole('button', { name: 'Refresh', exact: true }).click(),
    );
    expect(settled).toMatchObject({ outstandingMinor: 0, reservedMinor: 0, availableMinor: 0 });
    expect(settled.capturedAccountPaymentMinor).toBe(1500);

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
    await admin.page.reload();
    const history = admin.page.getByRole('region', { name: 'Amendment history', exact: true });
    await expect(history).toHaveCount(1);
    const historyDisclosure = history.locator(':scope > details');
    await expect(historyDisclosure).toHaveCount(1);
    const historySummary = historyDisclosure.locator(':scope > summary');
    await expect(historySummary).toHaveCount(1);
    await historySummary.click();
    await expect(historyDisclosure).toHaveAttribute('open', '');
    await history.getByRole('button', { name: 'Resolve payment correction', exact: true }).click();
    const correction = admin.page.getByRole('dialog', { name: 'Payment correction', exact: true });
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
      cashReturnForm.getByRole('button', { name: 'Record cash refunds', exact: true }).click(),
    );
    await expect(correction.getByText('Correction resolved', { exact: true })).toBeVisible({ timeout: 120_000 });

    await retainMixedTenderEvidence(visit.sessionId, orderId, amendment.amendmentId, {
      onlineOperationId: online.operationId,
      cashOperationId: cashQuote.operationId,
    });
  } finally {
    for (const context of contexts) await context.close();
    await closeDbPool();
  }
});
