import { generateSimpleReceiptHtml } from './simpleReceipt';
import { PaymentMethod } from '@/types/order';
import { makeOrderItem, singleKitchenBundleOrder, nestedBundleOrder } from '../__fixtures__/bundleOrderFixture';

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

  it('keeps selections from one menu section adjacent in their original order', () => {
    const order = singleKitchenBundleOrder();
    order.items[0].sideItems = [
      makeOrderItem({ id: 'steak', productName: 'Steak', kind: 'BundleChild', sectionId: 'meat', quantity: 1 }),
      makeOrderItem({ id: 'carrier', productName: 'Tacos 3 viandes', kind: 'BundleChild' }),
      makeOrderItem({ id: 'fries', productName: 'Fries', kind: 'BundleChild', sectionId: 'side' }),
      makeOrderItem({ id: 'kebab', productName: 'Kebab', kind: 'BundleChild', sectionId: 'meat', quantity: 2 }),
      makeOrderItem({ id: 'cola', productName: 'Cola', kind: 'BundleChild', sectionId: 'drink' }),
    ];

    const html = generateSimpleReceiptHtml(order);
    const steak = html.indexOf('1x Steak');
    const kebab = html.indexOf('2x Kebab');
    const carrier = html.indexOf('1x Tacos 3 viandes');
    const fries = html.indexOf('1x Fries');
    const cola = html.indexOf('1x Cola');

    expect(steak).toBeGreaterThan(-1);
    expect(kebab).toBeGreaterThan(steak);
    expect(carrier).toBeGreaterThan(kebab);
    expect(fries).toBeGreaterThan(carrier);
    expect(cola).toBeGreaterThan(fries);
  });

  it('prints a variation-only legacy note once and keeps distinct instructions', () => {
    const order = singleKitchenBundleOrder();
    order.items[0].variationName = 'French Fries';
    order.items[0].specialInstructions = ' French Fries ';

    const duplicateHtml = generateSimpleReceiptHtml(order);
    expect(duplicateHtml.split('French Fries').length - 1).toBe(1);

    order.items[0].specialInstructions = 'No salt';
    expect(generateSimpleReceiptHtml(order)).toContain('No salt');
  });
});

describe('generateSimpleReceiptHtml — payment method labels', () => {
  it('renders CreditCard as card at restaurant instead of the raw enum', () => {
    const order = singleKitchenBundleOrder();
    order.payments = [
      {
        id: 'payment-1',
        orderId: order.id,
        paymentMethod: PaymentMethod.CreditCard,
        amount: order.total,
        status: 'Pending',
      },
    ];

    const html = generateSimpleReceiptHtml(order);

    expect(html).toContain('Card at restaurant');
    expect(html).not.toContain('CreditCard');
  });

  it('prints captured staff gratuity and refunds separately from the order amount', () => {
    const order = singleKitchenBundleOrder();
    order.totalPaid = 20;
    order.paymentTipMinor = 200;
    order.payments = [
      {
        id: 'payment-tip',
        orderId: order.id,
        paymentMethod: PaymentMethod.Cash,
        amount: 20,
        status: 'PartiallyRefunded',
        tipMinor: 300,
        refundedTipMinor: 100,
      },
    ];

    const html = generateSimpleReceiptHtml(order);

    expect(html).toContain('Tip for staff');
    expect(html).toContain('Tip refunded');
    expect(html).toContain('Total collected');
    const printedText = html.replace(/\u00a0/g, ' ');
    expect(printedText).toContain('CHF 20.00');
    expect(printedText).toContain('CHF 3.00');
    expect(printedText).toContain('CHF 1.00');
    expect(printedText).toContain('CHF 22.00');
  });

  it('keeps the total-collection line when the recorded staff tip was fully refunded', () => {
    const order = singleKitchenBundleOrder();
    order.totalPaid = 20;
    order.paymentTipMinor = 0;
    order.payments = [
      {
        id: 'payment-tip-refunded',
        orderId: order.id,
        paymentMethod: PaymentMethod.Cash,
        amount: 20,
        status: 'Refunded',
        tipMinor: 300,
        refundedTipMinor: 300,
      },
    ];

    const printedText = generateSimpleReceiptHtml(order).replace(/\u00a0/g, ' ');

    expect(printedText).toContain('Tip for staff: CHF 3.00');
    expect(printedText).toContain('Tip refunded: CHF 3.00');
    expect(printedText).toContain('Total collected: CHF 20.00');
  });
});

describe('generateSimpleReceiptHtml — table identity', () => {
  it('prints an alphanumeric table label when the numeric compatibility field is null', () => {
    const order = singleKitchenBundleOrder();
    order.tableId = 'table-qa';
    order.tableLabel = 'T-QA';
    order.tableNumber = null;

    const html = generateSimpleReceiptHtml(order);

    expect(html).toContain('- Table T-QA');
    expect(html).not.toContain('undefined');
  });
});
