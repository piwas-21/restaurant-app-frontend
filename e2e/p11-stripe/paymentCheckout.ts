import { expect, type Page } from '@playwright/test';
import type { GuestAccountCheckoutStatus, GuestAccountPaymentOperation } from '../../src/types/guestAccountPayments';
import {
  installGuestStorageReturnObserver,
  readGuestStoragePresence,
  type GuestStorageDiagnostic,
} from './guestStorageDiagnostics';
import { runSequentially } from './sequential';
import { PRODUCT, responseData } from './tableVisit';

export type PaymentChoice = 'Items' | 'Amount' | 'EqualFirst' | 'EqualSecond';

interface ContributionHooks {
  readonly afterQuote?: (operation: GuestAccountPaymentOperation) => Promise<void>;
  readonly afterCheckout?: (
    operation: GuestAccountPaymentOperation,
    checkout: GuestAccountCheckoutStatus,
  ) => Promise<void>;
  readonly onStorageDiagnostic?: (snapshot: GuestStorageDiagnostic) => void | Promise<void>;
  readonly expectedAppOrigin?: string;
}

export async function completeContribution(
  page: Page,
  choice: PaymentChoice,
  expectedMinor: number,
  hooks: ContributionHooks = {},
) {
  const panel = page.getByRole('region', { name: 'Contribute to the table account', exact: true });
  await expect(panel.getByRole('button', { name: 'Review contribution', exact: true })).toBeEnabled();
  if (choice === 'Items') {
    await panel.getByRole('radio', { name: 'Choose order items', exact: true }).check();
    await panel.getByRole('spinbutton', { name: `Units to include for ${PRODUCT}`, exact: true }).fill('1');
  } else if (choice === 'Amount') {
    await panel.getByRole('radio', { name: 'Choose an amount', exact: true }).check();
    await panel.getByLabel('Contribution amount', { exact: true }).fill('5.01');
  } else {
    await panel.getByRole('radio', { name: 'Equal share', exact: true }).check();
    if (choice === 'EqualFirst') {
      await panel.getByLabel('Number of shares', { exact: true }).fill('2');
      await responseData(page, /\/equal-share-plans$/, () =>
        panel.getByRole('button', { name: 'Create or update shares', exact: true }).click(),
      );
    }
    await panel.getByRole('radio', { name: new RegExp(`^Share ${choice === 'EqualFirst' ? 1 : 2} ·`) }).check();
  }
  const operation = await responseData<GuestAccountPaymentOperation>(page, /\/account-payments\/quotes$/, () =>
    panel.getByRole('button', { name: 'Review contribution', exact: true }).click(),
  );
  expect(operation).toMatchObject({ amountMinor: expectedMinor, currency: 'CHF', paymentMethod: 'OnlinePayment' });
  expect(operation.mode).toBe(choice.startsWith('Equal') ? 'Equal' : choice);
  if (choice === 'Items') expect(operation.allocations.reduce((sum, value) => sum + value.unitCount, 0)).toBe(1);
  await hooks.afterQuote?.(operation);
  const expectedAppOrigin = hooks.expectedAppOrigin ?? new URL(page.url()).origin;
  let storageObserver: (() => Promise<void>) | undefined;
  if (hooks.onStorageDiagnostic) {
    await hooks.onStorageDiagnostic(await readGuestStoragePresence(page, expectedAppOrigin, 'before-departure'));
    storageObserver = await installGuestStorageReturnObserver(page, expectedAppOrigin, hooks.onStorageDiagnostic);
  }
  try {
    const checkout = await responseData<GuestAccountCheckoutStatus>(page, /\/checkout$/, () =>
      page.getByRole('button', { name: 'Continue to secure checkout', exact: true }).click(),
    );
    expect(checkout).toMatchObject({ operationId: operation.operationId, amountMinor: expectedMinor, currency: 'CHF' });
    expect(checkout.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    await hooks.afterCheckout?.(operation, checkout);
    await expect(page).toHaveURL(/^https:\/\/checkout\.stripe\.com\//);
    const sourceCurrency = page.locator('button').filter({ hasText: /\bCHF\b/ });
    await expect(sourceCurrency).toHaveCount(1);
    await expect(sourceCurrency).toBeVisible();
    if (await sourceCurrency.isEnabled()) await sourceCurrency.click();
    await expect(sourceCurrency).toBeDisabled();

    const cardMethod = page.getByRole('button', { name: 'Pay with card', exact: true });
    await expect(cardMethod).toHaveCount(1);
    const cardMethodIsOpen = async () => {
      const [expanded, className] = await Promise.all([
        cardMethod.getAttribute('aria-expanded'),
        cardMethod.getAttribute('class'),
      ]);
      return expanded === 'true' || className?.split(/\s+/).includes('AccordionButton-open') === true;
    };
    if (!(await cardMethodIsOpen())) {
      await expect(cardMethod).toBeVisible();
      await cardMethod.click();
    }
    await expect.poll(cardMethodIsOpen).toBe(true);
    const cardNumber = page.getByLabel('Card number', { exact: true });
    const expiration = page.getByLabel('Expiration', { exact: true });
    const securityCode = page.getByRole('textbox', { name: 'Credit or debit card CVC/CVV', exact: true });
    const cardholder = page.getByLabel('Cardholder name', { exact: true });
    await runSequentially([cardNumber, expiration, securityCode, cardholder], async (field) => {
      await expect(field).toHaveCount(1);
      await expect(field).toBeVisible();
    });

    const payButton = page.locator('button[type="submit"]');
    await expect(payButton).toHaveCount(1);
    await expect(payButton).toBeVisible();
    await expect(payButton).toBeEnabled();
    await expect(payButton).toContainText(/^Pay/);
    // Stripe's documented successful test card; recording is disabled in this dedicated profile.
    await page.getByLabel('Email', { exact: true }).fill('e2e-p11-checkout@test.local');
    await cardNumber.fill('4242424242424242');
    await expiration.fill('1235');
    await securityCode.fill('123');
    await cardholder.fill('P11 Test Guest');
    await payButton.click();
    await expect(page).toHaveURL(/\/en\/table-account\?/);
    const receipt = page.getByRole('region', { name: 'Your contribution', exact: true });
    await expect(receipt).toContainText('Payment confirmed', { timeout: 120_000 });
    const received = receipt.getByText('Received', { exact: true }).locator('xpath=following-sibling::dd[1]');
    const [whole, fraction] = (expectedMinor / 100).toFixed(2).split('.');
    expect((await received.innerText()).replace(/[\u00a0\u202f]/g, ' ').trim()).toMatch(
      new RegExp(String.raw`^(?:CHF\s*${whole}[.,]${fraction}|${whole}[.,]${fraction}\s*CHF)$`),
    );
    return {
      attemptId: checkout.attemptId,
      operationId: operation.operationId,
      mode: operation.mode,
      amountMinor: expectedMinor,
    };
  } finally {
    await storageObserver?.();
  }
}
