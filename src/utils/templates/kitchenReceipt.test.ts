import { generateKitchenReceiptHtml } from './kitchenReceipt';
import { formatCurrency } from '../currency';
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

/**
 * The `'All'` ticket is the one that prints prices — `generateKitchenReceiptHtml` sets
 * `showPrices = kitchenType === 'All'` and its own comment calls that ticket customer-facing. A
 * CHILD row carries `itemTotal = 0` by convention (the parent's total already holds the rolled-up
 * price, backend `OrderItemFactory`), so every combo component and every add-on side printed a bare
 * `CHF 0.00` next to its name — on paper, in front of a guest.
 *
 * Pre-existing and only ever reachable through a guest order until frontend #595 gave the waiter's
 * POS its own child rows, which is what put it on the restaurant's own tickets. The SCREEN has
 * always been right about this: `OrderLineSummary.tsx` prints a side's price only when `> 0`. The
 * receipt was the copy that disagreed.
 */
describe('generateKitchenReceiptHtml — a child row with no total of its own', () => {
  const orderWithSide = () => {
    const order = makeOrder([
      makeOrderItem({
        id: 'pizza',
        productName: 'Margherita',
        kitchenType: 'FrontKitchen',
        quantity: 2,
        unitPrice: 20.5,
        itemTotal: 41,
        sideItems: [
          makeOrderItem({
            id: 'coke',
            productName: 'Coke',
            kitchenType: 'FrontKitchen',
            quantity: 2, // already scaled by the server: 1 per unit x a line of 2
            unitPrice: 2.5,
            itemTotal: 0, // pinned by OrderItemFactory — the parent carries the money
            kind: 'SideItem',
          }),
        ],
      }),
    ]);
    order.subTotal = 41;
    order.total = 41;
    return order;
  };

  // The child fragment, not a loose `not.toContain('0.00')`: the ticket's own totals block prints
  // "CHF 41.00", so a bare "0.00" search matches money that is supposed to be there.
  const cokeRow = (html: string) =>
    html.split('<div style="margin-left: 24px; font-size: 11pt;">')[1]?.split('</div>')[0];

  it('prints the side without a price rather than with a zero one', () => {
    const html = generateKitchenReceiptHtml(orderWithSide(), 'All');

    expect(html).not.toBeNull();
    // The defect, named: the child used to render as `+ Coke x2 (CHF 0.00)`.
    expect(cokeRow(html!)).toBe('+ Coke x2');
  });

  it('still prints the PARENT total, so suppressing the zero costs no real price', () => {
    const html = generateKitchenReceiptHtml(orderWithSide(), 'All');

    // The control. An assertion that the zero is gone is also satisfied by a ticket that prints no
    // money at all, which would be a worse bug than the one being fixed.
    // Through `formatCurrency`, because it separates the code from the amount with a NON-BREAKING
    // space — a hand-typed 'CHF 41.00' does not match and says nothing useful when it fails.
    expect(html).toContain(formatCurrency(41));
    expect(html).toContain(`2 @ ${formatCurrency(20.5)}`);
  });

  it('prints a child total that is genuinely non-zero — the suppression is a zero rule, not a child rule', () => {
    const order = orderWithSide();
    order.items[0].sideItems![0].itemTotal = 5;

    expect(cokeRow(generateKitchenReceiptHtml(order, 'All')!)).toBe(`+ Coke x2 (${formatCurrency(5)})`);
  });
});
