import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderCard from '../OrderCard';
import { OrderType } from '@/types/order';
import type { OrderDto } from '@/types/order';

/**
 * #547 — the waiter card's next action must come from the SHARED transition table
 * (`src/lib/orderStatus.ts`), not a private ladder. The ladder this card used to own handled
 * six statuses and could not express `Ready → OutForDelivery`, so a delivery order could not
 * be dispatched from the surface that sees it.
 *
 * The four transitions that existed before are pinned as-is (they must stay byte-compatible —
 * this is staff-facing POS surface), and the delivery paths are pinned as the addition.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Distinct fallbacks per key, exactly like the component's callsites: an assertion on the
    // button's text is an assertion on the KEY that produced it.
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

const buildOrder = (overrides: Partial<Record<string, unknown>> = {}): OrderDto =>
  ({
    id: 'o1',
    orderNumber: '1042',
    tableNumber: '7',
    status: 'Pending',
    type: OrderType.DineIn,
    orderDate: new Date('2026-08-28T15:45:12Z').toISOString(),
    total: 42,
    items: [],
    ...overrides,
  }) as unknown as OrderDto;

describe('the primary next action comes from the shared transition table', () => {
  it.each([
    ['Pending', OrderType.DineIn, 'Confirm Order', 'Confirmed'],
    ['Confirmed', OrderType.DineIn, 'Start Preparing', 'Preparing'],
    ['Preparing', OrderType.DineIn, 'Mark Ready', 'Ready'],
    // The byte-compat pins: a NON-delivery order still completes from Ready, as it always did.
    ['Ready', OrderType.DineIn, 'Complete Order', 'Completed'],
    ['Ready', OrderType.Takeaway, 'Complete Order', 'Completed'],
  ])('%s (%s) offers %s and dispatches %s', (status, type, label, target) => {
    const onStatusChange = jest.fn();
    render(<OrderCard order={buildOrder({ status, type })} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onStatusChange).toHaveBeenCalledWith('o1', target);
  });

  /** The fix itself: a delivery order can be dispatched from the waiter card. */
  it.each([
    ['Ready', OrderType.Delivery, 'Out for Delivery', 'OutForDelivery'],
    // …and the dispatch has a way forward: the table's OutForDelivery row leads to Completed.
    ['OutForDelivery', OrderType.Delivery, 'Complete Order', 'Completed'],
  ])('%s (%s) offers %s and dispatches %s', (status, type, label, target) => {
    const onStatusChange = jest.fn();
    render(<OrderCard order={buildOrder({ status, type })} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onStatusChange).toHaveBeenCalledWith('o1', target);
  });

  it('never offers Cancelled as the primary action', () => {
    for (const status of ['Pending', 'Confirmed', 'Preparing', 'Ready']) {
      render(<OrderCard order={buildOrder({ status })} onStatusChange={jest.fn()} />);
      expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
    }
  });

  it('shows no action for a terminal status', () => {
    for (const status of ['Completed', 'Cancelled']) {
      render(<OrderCard order={buildOrder({ status })} onStatusChange={jest.fn()} />);
      expect(screen.queryByRole('button', { name: /Order|Preparing|Ready|Delivery/ })).not.toBeInTheDocument();
    }
  });

  /**
   * A state the OLD ladder dead-ended (it returned null, so the card showed no action at all).
   * The shared table knows PendingApproval → Confirmed, so the card now offers it — the same
   * un-stranding the cashier dialog already got from this table.
   */
  it('offers Confirm for a PendingApproval order, which the old ladder dead-ended', () => {
    const onStatusChange = jest.fn();
    render(<OrderCard order={buildOrder({ status: 'PendingApproval' })} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
    expect(onStatusChange).toHaveBeenCalledWith('o1', 'Confirmed');
  });
});

describe('the card wears the shared status colour hook', () => {
  // The six hexes in the module were the six --status-* values on DIFFERENT statuses (#381);
  // after the repaint every orderStatusMeta class resolves, including the two the module used
  // to omit. identity-obj-proxy makes the class name itself the assertion.
  it.each([
    ['Pending', 'statusPending'],
    ['Ready', 'statusReady'],
    ['OutForDelivery', 'statusInTransit'],
    ['InTransit', 'statusInTransit'],
    ['Delivered', 'statusDelivered'],
    ['Completed', 'statusCompleted'],
    ['Cancelled', 'statusCancelled'],
  ])('a %s card carries the %s modifier', (status, modifier) => {
    const { container } = render(<OrderCard order={buildOrder({ status })} onStatusChange={jest.fn()} />);
    expect(container.firstChild).toHaveClass('card', modifier);
  });
});
