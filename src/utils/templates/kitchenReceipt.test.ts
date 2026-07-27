import { generateKitchenReceiptHtml } from './kitchenReceipt';
import {
  makeOrder,
  makeOrderItem,
  singleKitchenBundleOrder,
  mixedKitchenBundleOrder,
} from '../__fixtures__/bundleOrderFixture';

/** How many times a product name appears in the ticket — the double-render guard. */
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

describe('generateKitchenReceiptHtml — single-kitchen bundle', () => {
  const order = singleKitchenBundleOrder();

  it('prints one front-kitchen ticket with the components nested exactly once', () => {
    const html = generateKitchenReceiptHtml(order, 'FrontKitchen');

    expect(html).not.toBeNull();
    expect(occurrences(html!, 'Mezze Combo')).toBe(1);
    expect(occurrences(html!, 'Hummus')).toBe(1);
    expect(occurrences(html!, 'Fattoush Salad')).toBe(1);
    expect(html).toContain('Additionals:');
  });

  it('prints no back-kitchen ticket at all', () => {
    expect(generateKitchenReceiptHtml(order, 'BackKitchen')).toBeNull();
  });
});

describe('generateKitchenReceiptHtml — mixed-kitchen bundle', () => {
  const order = mixedKitchenBundleOrder();

  it('gives the front kitchen the combo without the back kitchen’s fries', () => {
    const html = generateKitchenReceiptHtml(order, 'FrontKitchen');

    expect(html).not.toBeNull();
    expect(occurrences(html!, 'Burger Combo')).toBe(1);
    expect(occurrences(html!, 'Beef Burger')).toBe(1);
    expect(html).not.toContain('Fries');
  });

  it('gives the back kitchen its own ticket with the fries — the #237 regression', () => {
    const html = generateKitchenReceiptHtml(order, 'BackKitchen');

    expect(html).not.toBeNull();
    expect(occurrences(html!, 'Fries')).toBe(1);
    // The parent combo belongs to the front kitchen and must not appear here.
    expect(html).not.toContain('Burger Combo');
    expect(html).not.toContain('Beef Burger');
    expect(html).not.toContain('Additionals:');
  });

  it('shows the whole tree on the customer-facing "All" ticket, with prices', () => {
    const html = generateKitchenReceiptHtml(order, 'All');

    expect(html).not.toBeNull();
    expect(occurrences(html!, 'Burger Combo')).toBe(1);
    expect(occurrences(html!, 'Beef Burger')).toBe(1);
    expect(occurrences(html!, 'Fries')).toBe(1);
    expect(html).toContain('TOTAL:');
  });
});

describe('generateKitchenReceiptHtml — nesting depth', () => {
  it('renders a grandchild rather than dropping it', () => {
    const order = makeOrder([
      makeOrderItem({
        id: 'platter',
        productName: 'Sharing Platter',
        kitchenType: 'FrontKitchen',
        sideItems: [
          makeOrderItem({
            id: 'wrap',
            productName: 'Chicken Wrap',
            kitchenType: 'FrontKitchen',
            kind: 'BundleChild',
            sideItems: [
              makeOrderItem({
                id: 'sauce',
                productName: 'Garlic Sauce',
                kitchenType: 'FrontKitchen',
                kind: 'SideItem',
              }),
            ],
          }),
        ],
      }),
    ]);

    const html = generateKitchenReceiptHtml(order, 'FrontKitchen');

    expect(occurrences(html!, 'Sharing Platter')).toBe(1);
    expect(occurrences(html!, 'Chicken Wrap')).toBe(1);
    expect(occurrences(html!, 'Garlic Sauce')).toBe(1);
  });
});
