import { generateKitchenReceiptHtml } from './kitchenReceipt';
import { generateSimpleReceiptHtml } from './simpleReceipt';
import { singleKitchenBundleOrder } from '../__fixtures__/bundleOrderFixture';
import { receiptDate } from './receiptOptions';

it.each([58, 80] as const)('generates %imm kitchen and customer receipts without changing prices', (paperWidthMm) => {
  const order = singleKitchenBundleOrder();
  for (const html of [
    generateSimpleReceiptHtml(order, undefined, { paperWidthMm }),
    generateKitchenReceiptHtml(order, 'All', undefined, { paperWidthMm }),
  ]) {
    expect(html).toContain(`size: ${paperWidthMm}mm auto`);
    expect(html).toContain('20.00');
    expect(html).not.toContain('0.00)');
  }
});

it('formats the receipt timestamp using the requested locale', () => {
  const date = '2026-10-09T12:00:00Z';
  expect(receiptDate(date, { locale: 'fr-FR' })).toContain('09/10/2026');
  expect(receiptDate(date, { locale: 'de-DE' })).toContain('09.10.2026');
});

it('sets Arabic print direction while keeping amounts in an isolated unbroken currency span', () => {
  const html = generateSimpleReceiptHtml(singleKitchenBundleOrder(), undefined, { paperWidthMm: 58, locale: 'ar' });
  const document = new DOMParser().parseFromString(html, 'text/html');
  expect(document.documentElement.getAttribute('lang')).toBe('ar');
  expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  expect(document.querySelector('.flex-row > span[dir="ltr"]')?.textContent).toContain('20.00');
  expect(html).toContain('white-space: nowrap; direction: ltr; unicode-bidi: isolate;');
});
