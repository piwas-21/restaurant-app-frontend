import { receiptItems } from './receiptPresentation';
import { generateKitchenReceiptHtml } from './kitchenReceipt';
import { generateSimpleReceiptHtml } from './simpleReceipt';
import { makeOrder, makeOrderItem } from '../__fixtures__/bundleOrderFixture';
import { PaymentMethod } from '@/types/order';

const fixture = (quantity: number, kebab: number, steak: number) => {
  const order = makeOrder([
    makeOrderItem({
      id: 'menu',
      productName: 'Menu Tacos 3 Viande',
      quantity,
      itemTotal: 30,
      sideItems: [
        makeOrderItem({
          id: 'cola',
          productName: 'Coca Cola 33cl',
          quantity,
          compositionRole: 'Drink',
          quantityBasis: 'LineTotal',
        }),
        makeOrderItem({
          id: 'kebab',
          productName: 'Kebab',
          quantity: kebab,
          parentComponentOrderItemId: 'taco',
          compositionRole: 'RequiredChoice',
          quantityBasis: 'LineTotal',
        }),
        makeOrderItem({
          id: 'steak',
          productName: 'Steak',
          quantity: steak,
          parentComponentOrderItemId: 'taco',
          compositionRole: 'RequiredChoice',
          quantityBasis: 'LineTotal',
        }),
        makeOrderItem({
          id: 'taco',
          productName: 'Tacos 3 viandes',
          quantity,
          compositionRole: 'Dish',
          quantityBasis: 'LineTotal',
          ingredientCustomizations: [
            {
              ingredientId: 'cheddar',
              ingredientName: 'Cheddar',
              isRemoved: false,
              isAddOn: true,
              quantity: 1,
              quantityBasis: 'PerParentUnit',
              configurationScope: 'SharedAcrossParentUnits',
              compositionRole: 'Extra',
            },
          ],
        }),
        makeOrderItem({
          id: 'fries',
          productName: 'Frites',
          quantity,
          compositionRole: 'Side',
          quantityBasis: 'LineTotal',
        }),
      ],
    }),
  ]);
  order.subTotal = 30;
  order.total = 30;
  order.remainingAmount = 30;
  return order;
};

it.each([
  [1, 2, 1, '+ Kebab x2', '+ Steak x1'],
  [2, 4, 2, '+ Kebab x4', '+ Steak x2'],
  [3, 6, 3, '+ Kebab x6', '+ Steak x3'],
])(
  'uses frozen line totals for %i menus without scaling a second time',
  (quantity, kebab, steak, expectedKebab, expectedSteak) => {
    const order = fixture(quantity, kebab, steak);
    const original = JSON.stringify(order);
    const html = generateKitchenReceiptHtml(JSON.parse(original), 'GeneralKitchen')!;
    expect(html).toContain(`${expectedKebab} — Total for this line`);
    expect(html).toContain(`${expectedSteak} — Total for this line`);
    expect(html).toContain('+ EXTRA Cheddar x1 — Per item: Tacos 3 viandes');
    expect(html).toContain(`<strong>${quantity}x Tacos 3 viandes</strong>`);
    expect(html).not.toContain('+ Tacos 3 viandes');
    expect(html.indexOf('Tacos 3 viandes')).toBeLessThan(html.indexOf('Kebab'));
    expect(html.indexOf('Steak')).toBeLessThan(html.indexOf('Cheddar'));
    expect(html.indexOf('Cheddar')).toBeLessThan(html.indexOf('Frites'));
    expect(html.indexOf('Frites')).toBeLessThan(html.indexOf('Coca Cola'));
    expect(html).not.toContain('CHF');
    expect(JSON.stringify(order)).toBe(original);
  },
);

it('keeps separately configured lines and unknown historical quantities distinct', () => {
  const order = fixture(2, 4, 2);
  order.items.push(
    makeOrderItem({
      id: 'second',
      productName: 'Menu Tacos 3 Viande',
      quantity: 1,
      ingredientCustomizations: [
        { ingredientId: 'no-cheddar', ingredientName: 'Cheddar', quantity: 0, isRemoved: true },
      ],
      sideItems: [makeOrderItem({ id: 'old-steak', productName: 'Steak', quantity: 7 })],
    }),
  );
  const html = generateKitchenReceiptHtml(order, 'GeneralKitchen')!;
  expect(html).toContain('+ Steak x7');
  expect(html).toContain('✘ NO Cheddar');
  expect(html).toContain('2x Menu Tacos 3 Viande');
  expect(html).toContain('1x Menu Tacos 3 Viande');
});

it('includes standalone and bundle ingredient changes on cashier receipts without ingredient charges', () => {
  const order = fixture(2, 4, 2);
  order.items.push(
    makeOrderItem({
      id: 'single',
      productName: 'Single taco',
      ingredientCustomizations: [
        { ingredientId: 'remove', ingredientName: 'Onion', quantity: 0, isRemoved: true },
        { ingredientId: 'extra', ingredientName: 'Garlic', quantity: 1, isAddOn: true, isRemoved: false },
      ],
    }),
  );
  const html = generateSimpleReceiptHtml(order);
  expect(html).toContain('EXTRA Cheddar x1 — Per item: Tacos 3 viandes');
  expect(html).toContain('NO Onion');
  expect(html).toContain('EXTRA Garlic');
  expect(html).not.toContain('Cheddar (');
  expect(html).not.toContain('Garlic (');
});

it('keeps invalid ownership and cyclic siblings visible without guessing names', () => {
  const rows = [
    makeOrderItem({ id: 'a', productName: 'Taco', parentComponentOrderItemId: 'b' }),
    makeOrderItem({ id: 'b', productName: 'Taco', parentComponentOrderItemId: 'a' }),
    makeOrderItem({ id: 'c', productName: 'Choice', parentComponentOrderItemId: 'missing' }),
  ];
  expect(receiptItems(rows).map((row) => row.id)).toEqual(['a', 'b', 'c']);
});

it.each(['Pending', 'Failed'] as const)('does not print a %s tender as received money', (status) => {
  const order = fixture(2, 4, 2);
  order.payments = [{ id: 'p', orderId: order.id, paymentMethod: PaymentMethod.CreditCard, amount: 777, status }];
  const html = generateSimpleReceiptHtml(order).replace(/\u00a0/g, ' ');
  expect(html).toContain('Payment Status: Unpaid');
  expect(html).toContain('Payment received: CHF 0.00');
  expect(html).toContain('Still to pay: CHF 30.00');
  expect(html).not.toContain('777.00');
});

it('prints authoritative partial balances and captured refunds while preserving parent prices', () => {
  const order = fixture(2, 4, 2);
  order.totalPaid = 8;
  order.remainingAmount = 22;
  order.payments = [
    {
      id: 'p',
      orderId: order.id,
      paymentMethod: PaymentMethod.Cash,
      amount: 10,
      refundedAmount: 2,
      status: 'PartiallyRefunded',
    },
  ];
  const html = generateSimpleReceiptHtml(order).replace(/\u00a0/g, ' ');
  expect(html).toContain('Partly paid');
  expect(html).toContain('Payment received: CHF 8.00');
  expect(html).toContain('Still to pay: CHF 22.00');
  expect(html).toContain('Refund Amount: CHF 2.00');
  expect(html).toContain('30.00');
  expect(html).not.toContain('Cheddar (');
});

it('prints explicit unknown quantities even for a single unit without hiding or dividing them', () => {
  const order = makeOrder([
    makeOrderItem({
      id: 'parent',
      productName: 'Dish',
      quantity: 1,
      ingredientCustomizations: [
        {
          ingredientId: 'extra',
          ingredientName: 'Extra sauce',
          quantity: 1,
          isRemoved: false,
          isAddOn: true,
          quantityBasis: 'Unknown',
          configurationScope: 'Unknown',
        },
      ],
      sideItems: [makeOrderItem({ id: 'choice', productName: 'Choice', quantity: 1, quantityBasis: 'Unknown' })],
    }),
  ]);
  const html = generateKitchenReceiptHtml(order, 'GeneralKitchen')!;
  expect(html).toContain('+ EXTRA Extra sauce x1 — Recorded quantity');
  expect(html).toContain('+ Choice x1 — Recorded quantity');
});

it.each(['Unknown', 'IndependentParentUnits', undefined, null] as const)(
  'does not infer a shared per-item configuration from %s scope',
  (configurationScope) => {
    const order = makeOrder([
      makeOrderItem({
        id: 'parent',
        productName: 'Dish',
        quantity: 2,
        ingredientCustomizations: [
          {
            ingredientId: 'extra',
            ingredientName: 'Cheddar',
            quantity: 1,
            isRemoved: false,
            isAddOn: true,
            quantityBasis: 'PerParentUnit',
            configurationScope,
          },
        ],
      }),
    ]);
    const html = generateKitchenReceiptHtml(order, 'GeneralKitchen')!;
    expect(html).toContain('Cheddar x1 — Recorded quantity');
    expect(html).not.toContain('Per item');
  },
);
