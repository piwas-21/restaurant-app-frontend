import { generateSimpleReceiptHtml } from './simpleReceipt';
import { generateKitchenReceiptHtml } from './kitchenReceipt';
import { marketplaceOrder } from '../__fixtures__/marketplaceOrderFixture';

it.each(['simple', 'all'])(
  '%s customer receipt preserves source, money, unknown tax and escaped instructions',
  (kind) => {
    const order = marketplaceOrder();
    order.externalOrder!.externalDisplayId = '9116D <img onerror="bad">';
    const html = kind === 'simple' ? generateSimpleReceiptHtml(order) : generateKitchenReceiptHtml(order, 'All')!;
    expect(html).toContain('Uber Eats');
    expect(html).toContain('Test order');
    expect(html).toContain('Payment handled by Uber Eats');
    expect(html).toContain('Not reported by provider');
    expect(html).not.toContain('CHF');
    expect(html).toContain('5.00');
    expect(html).not.toContain('11.47');
    expect(html).toContain('ALLERGY: no peanuts &lt;script&gt;unsafe()&lt;/script&gt;');
    expect(html).toContain('no food, no courier &amp; keep instructions');
    expect(html).toContain('9116D &lt;img onerror=&quot;bad&quot;&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
  },
);
it.each(['simple', 'all'])('%s prints explicit zero tax without calling it unknown', (kind) => {
  const order = marketplaceOrder();
  order.externalOrder!.reportedTax = 0;
  const html = kind === 'simple' ? generateSimpleReceiptHtml(order) : generateKitchenReceiptHtml(order, 'All')!;
  expect(html).not.toContain('Not reported by provider');
  expect(html).toContain('0.00');
});
it('kitchen tickets show identity and instructions without money, tax or payment details', () => {
  const html = generateKitchenReceiptHtml(marketplaceOrder(), 'GeneralKitchen')!;
  expect(html).toContain('Uber Eats');
  expect(html).toContain('9116D');
  expect(html).toContain('Test order');
  expect(html).toContain('ALLERGY: no peanuts');
  expect(html).toContain('TEST ONLY: no food');
  expect(html).not.toContain('5.00');
  expect(html).not.toContain('EUR');
  expect(html).not.toContain('CHF');
  expect(html).not.toContain('Payment handled');
  expect(html).not.toContain('Not reported');
});
it('propagates source currency to paid descendants in customer-facing All receipt', () => {
  const order = marketplaceOrder();
  order.items[0].sideItems = [
    { id: 'side', productId: 'side-product', productName: 'Paid side', quantity: 1, unitPrice: 2, itemTotal: 2 },
  ];
  const html = generateKitchenReceiptHtml(order, 'All')!;
  expect(html).toContain('Paid side');
  expect(html).toContain('2.00');
  expect(html).not.toContain('CHF');
});
