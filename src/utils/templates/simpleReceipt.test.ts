import { generateSimpleReceiptHtml } from './simpleReceipt';
import { singleKitchenBundleOrder, nestedBundleOrder } from '../__fixtures__/bundleOrderFixture';

/** How many times a product name appears on the bill — the double-render guard. */
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

describe('generateSimpleReceiptHtml — bundle components on the customer bill', () => {
  it('itemises the components of a combo under its line, exactly once each', () => {
    const html = generateSimpleReceiptHtml(singleKitchenBundleOrder());

    expect(occurrences(html, 'Mezze Combo')).toBe(1);
    expect(occurrences(html, 'Hummus')).toBe(1);
    expect(occurrences(html, 'Fattoush Salad')).toBe(1);
  });

  it('prints no price against a component (the parent line carries the whole amount)', () => {
    const html = generateSimpleReceiptHtml(singleKitchenBundleOrder());

    // The combo's own total is printed once; a child's itemTotal is 0 by convention and must not
    // reach the bill as a bare 0.00 beside every component.
    expect(html).toContain('20.00');
    expect(html).not.toContain('0.00)');
  });

  it('reaches a component of a component', () => {
    const html = generateSimpleReceiptHtml(nestedBundleOrder());

    expect(occurrences(html, 'Mezze Selection')).toBe(1);
    expect(occurrences(html, 'Hummus')).toBe(1);
  });

  it('escapes product names', () => {
    const order = singleKitchenBundleOrder();
    order.items[0].sideItems![0].productName = 'Hummus & <b>Pita</b>';

    const html = generateSimpleReceiptHtml(order);

    expect(html).toContain('Hummus &amp; &lt;b&gt;Pita&lt;/b&gt;');
  });
});
