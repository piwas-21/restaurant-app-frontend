import { currentOrderTicket, orderTableLabel } from './currentOrderTicket';
import { makeOrder, makeOrderItem } from '@/utils/__fixtures__/bundleOrderFixture';
import { generateSimpleReceiptHtml } from '@/utils/templates/simpleReceipt';
import type { OrderPaymentDto } from '@/types/order';

const kebab = makeOrderItem({ id: 'kebab', productName: 'Kebab', quantity: 2, unitPrice: 13, itemTotal: 26 });
const drink = makeOrderItem({ id: 'drink', productName: 'Ayran', unitPrice: 1.5, itemTotal: 1.5 });
const source = { ...makeOrder([kebab]), total: 26, subTotal: 26, remainingAmount: 26, currency: 'EUR' };
const supplement = { ...makeOrder([drink]), id: 'supplement', total: 1.5, subTotal: 1.5, remainingAmount: 1.5 };

it('combines current server items once and gives the bill the same authoritative amounts', () => {
  const ticket = currentOrderTicket(source, [source, supplement, supplement]);
  expect(ticket.items.map((item) => item.productName)).toEqual(['Kebab', 'Ayran']);
  expect(ticket.payableTotal).toBe(27.5);
  expect(ticket.remainingAmount).toBe(27.5);
  const document = new DOMParser().parseFromString(generateSimpleReceiptHtml(ticket), 'text/html');
  expect(document.body.textContent).toContain('Ayran');
  expect(document.querySelector('.total-line')?.textContent).toContain('27.50');
  expect(source.items).toEqual([kebab]);
  expect(ticket.id).toBe(source.id);
  expect(ticket.version).toBe(source.version);
});

it('uses effective server lines and billing credits without replaying removals or replacements', () => {
  const credited = {
    ...source,
    items: [{ ...kebab, quantity: 1, itemTotal: 13 }],
    billingCreditAmount: 13,
    payableTotal: 13,
    remainingAmount: 13,
  };
  const ticket = currentOrderTicket(source, [credited, supplement]);
  expect(ticket.items.map(({ productName, quantity, itemTotal }) => ({ productName, quantity, itemTotal }))).toEqual([
    { productName: 'Kebab', quantity: 1, itemTotal: 13 },
    { productName: 'Ayran', quantity: 1, itemTotal: 1.5 },
  ]);
  expect(ticket.payableTotal).toBe(14.5);
  expect(ticket.remainingAmount).toBe(14.5);
});

it('retains current instructions and ignores cancelled rounds', () => {
  const current = { ...source, items: [{ ...kebab, specialInstructions: 'No onion' }] };
  const ticket = currentOrderTicket(source, [current, { ...supplement, status: 'Cancelled' }]);
  expect(ticket.items).toEqual(current.items);
  expect(ticket.total).toBe(26);
});

it('combines captured payments and net staff tips from later additions', () => {
  const payment = {
    id: 'payment',
    amount: 1.5,
    tipMinor: 250,
    refundedTipMinor: 50,
    status: 'Completed',
    paymentMethod: 'Cash',
  } as OrderPaymentDto;
  const paid = { ...supplement, totalPaid: 1.5, remainingAmount: 0, payments: [payment], paymentTipMinor: 200 };
  const ticket = currentOrderTicket({ ...source, paymentTipMinor: 0 }, [source, paid]);
  expect(ticket.totalPaid).toBe(1.5);
  expect(ticket.paymentTipMinor).toBe(200);
  const html = generateSimpleReceiptHtml(ticket);
  const document = new DOMParser().parseFromString(html, 'text/html');
  expect(document.querySelector('.payment-summary')?.textContent?.replace(/\s+/g, ' ')).toContain(
    'Total collected: EUR 3.50',
  );
});

it('shows a table only for dine-in with a real label or number, preserving authored labels', () => {
  expect(orderTableLabel({ type: 'Takeaway', tableNumber: null })).toBeNull();
  expect(orderTableLabel({ type: 'Takeaway', tableNumber: 4 })).toBeNull();
  expect(orderTableLabel({ type: 'DineIn', tableNumber: null })).toBeNull();
  expect(orderTableLabel({ type: 'DineIn', tableLabel: '01', tableNumber: 1 })).toBe('01');
  expect(orderTableLabel({ type: 'DineIn', tableLabel: '11a' })).toBe('11a');
});

it('preserves current item details for cancelled amended orders', () => {
  const cancelled = { ...source, status: 'Cancelled', items: [] };
  expect(currentOrderTicket(source, [cancelled]).items).toEqual([]);
});

it('preserves server print permission on a marketplace receipt', () => {
  const current = {
    ...source,
    externalOrder: {
      provider: 'uber-eats',
      externalDisplayId: 'test',
      externalState: 'ACCEPTED',
      lastEventAt: '',
      currency: 'EUR',
      merchantTotal: 26,
      reportedTax: null,
      fulfillmentType: 'PICKUP',
      isSandbox: true,
    },
    permittedActions: [{ action: 'PrintReceipt', allowed: true, requiresReason: false }],
  };
  expect(currentOrderTicket(source, [current]).permittedActions).toEqual(current.permittedActions);
});
