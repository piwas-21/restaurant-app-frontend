import { render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import ReceiptItemDetails from '@/components/order/ReceiptItemDetails';
import wireOrder from '../__fixtures__/backendBasketReceiptWire.json';
import { makeOrderItem } from '../__fixtures__/bundleOrderFixture';
import { receiptItems } from './receiptPresentation';
import { generateKitchenReceiptHtml } from './kitchenReceipt';
import { generateSimpleReceiptHtml } from './simpleReceipt';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));

// Captured from backend PrinterFeedQuantityContractTests through basket and checkout endpoints.
// Quantities below are preparation oracles, independent of either receipt renderer.
const order = wireOrder as unknown as OrderDto;

it.each([
  [1, 2, 1, 1, 2, 3],
  [2, 4, 2, 2, 4, 6],
  [3, 6, 3, 3, 6, 9],
])('retains backend quantities and names for a %i-menu line', (quantity, beef, steak, sideOne, sideTwo, drink) => {
  const root = order.items.find((item) => item.quantity === quantity)!;
  const original = JSON.stringify(root);
  const projected = receiptItems([root])[0];
  const dish = (projected.sideItems ?? []).find((item) => item.compositionRole === 'Dish')!;
  expect(dish.presentationLabel).toBe('Taco');
  expect(dish.sideItems?.map((item) => item.productName)).toEqual([
    'Beef',
    'Steak',
    'Side One',
    'Side Two',
    'Side Three',
  ]);
  expect(dish.sideItems?.map((item) => item.quantity)).toEqual([beef, steak, sideOne, sideTwo, drink]);
  expect(dish.sideItems?.at(-1)?.compositionRole).toBe('Drink');
  expect(
    dish.ingredientCustomizations?.find((ingredient) => ingredient.ingredientName === 'Chili')?.compositionRole,
  ).toBe('Extra');
  const lineOrder = { ...order, items: [root] };
  const kitchen = generateKitchenReceiptHtml(lineOrder, 'GeneralKitchen')!;
  const cashier = generateSimpleReceiptHtml(lineOrder);
  for (const html of [kitchen, cashier]) {
    expect(html).toContain(`${beef}x Beef`);
    expect(html).toContain(`${steak}x Steak`);
    expect(html).toContain('NO Cheese');
    expect(html).toContain('+ 2x Chili');
    expect(html).not.toContain('Total for this line');
    expect(html).not.toContain('Recorded quantity');
    expect(html.indexOf('Steak')).toBeLessThan(html.indexOf('Chili'));
    expect(html.indexOf('Chili')).toBeLessThan(html.indexOf('Side One'));
    expect(html.indexOf('Side Two')).toBeLessThan(html.indexOf('Side Three'));
  }
  expect(kitchen).not.toContain('CHF');
  render(<ReceiptItemDetails item={root} />);
  expect(screen.getByText('Beef').closest('li')).toHaveTextContent(`${beef}× Beef`);
  expect(screen.getByText('Steak').closest('li')).toHaveTextContent(`${steak}× Steak`);
  expect(JSON.stringify(root)).toBe(original);
});

it('keeps the authoritative unpaid balance and only charges the parent lines', () => {
  const cashier = new DOMParser().parseFromString(generateSimpleReceiptHtml(order), 'text/html');
  const text = cashier.body.textContent!.replace(/\s+/g, ' ');
  expect(text).toContain('Payment Status: Unpaid');
  expect(text).toContain('Payment received: CHF 0.00');
  expect(text).toContain('Still to pay: CHF 465.00');
  const chargedLines = Array.from(cashier.querySelectorAll('.flex-row')).filter((row) => row.querySelector('strong'));
  expect(chargedLines).toHaveLength(3);
  expect(chargedLines.map((row) => row.lastElementChild?.textContent?.replace(/\s+/g, ' '))).toEqual(
    expect.arrayContaining(['CHF 232.50', 'CHF 155.00', 'CHF 77.50']),
  );
});

it('uses the immediate preparation owner for a side within a required choice', () => {
  const root = receiptItems([order.items.find((item) => item.quantity === 2)!])[0];
  const dish = (root.sideItems ?? []).find((item) => item.compositionRole === 'Dish')!;
  const beef = (dish.sideItems ?? []).find((item) => item.productName === 'Beef')!;
  beef.sideItems = [
    makeOrderItem({
      id: 'nested-side',
      productName: 'Nested side',
      quantity: 2,
      compositionRole: 'Side',
      quantityBasis: 'PerParentUnit',
      configurationScope: 'SharedAcrossParentUnits',
    }),
  ];
  for (const html of [
    generateKitchenReceiptHtml({ ...order, items: [root] }, 'GeneralKitchen')!,
    generateSimpleReceiptHtml({ ...order, items: [root] }),
  ]) {
    expect(html).toContain('2x Nested side (each)');
    expect(html).not.toContain('2x Nested side (each) (each)');
  }
  render(<ReceiptItemDetails item={root} />);
  expect(screen.getByText(/Nested side/).closest('li')).toHaveTextContent('2× Nested side (each)');
});
