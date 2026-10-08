import { expect, type Locator, type Page } from '@playwright/test';

export async function openPaymentCorrectionDialog(page: Page): Promise<Locator> {
  await page.reload();
  const history = page.getByRole('region', { name: 'Amendment history', exact: true });
  await expect(history).toHaveCount(1);
  const historyDisclosure = history.locator(':scope > details');
  await expect(historyDisclosure).toHaveCount(1);
  const historySummary = historyDisclosure.locator(':scope > summary');
  await expect(historySummary).toHaveCount(1);
  await historySummary.click();
  await expect(historyDisclosure).toHaveAttribute('open', '');
  await history.getByRole('button', { name: 'Resolve payment correction', exact: true }).click();
  return page.getByRole('dialog', { name: 'Payment correction', exact: true });
}
