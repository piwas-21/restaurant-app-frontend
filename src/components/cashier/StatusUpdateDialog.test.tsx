import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StatusUpdateDialog from './StatusUpdateDialog';
import type { OrderDto } from '@/types/order';

// Echoes the key, so a label that is a raw i18n key path shows up as one.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const order = (status: string) => ({ id: 'o1', orderNumber: 'A-1', status }) as unknown as OrderDto;

const open = (status: string) =>
  render(
    <StatusUpdateDialog isOpen order={order(status)} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />,
  );

/**
 * The dialog that decides what a cashier may do next to an order. It had no test, and it carried
 * its own transition `switch` that disagreed with the server's `IsValidStatusTransition` in six of
 * its states — while rendering every option through a key path (`order.status.X`) that exists in no
 * locale, so the options were labelled with the key itself.
 */
describe('StatusUpdateDialog', () => {
  it('lets a READY order be sent out for delivery — the transition that was missing', () => {
    // The one that mattered on the floor: without `OutForDelivery` here, a delivery could never be
    // dispatched from the till at all.
    open('Ready');

    expect(screen.getByText('order_status_in_transit')).toBeInTheDocument();
  });

  it('offers a way out of PendingApproval, which used to strand the order', () => {
    // The old ladder had no case for it, and its `default` returned [] — indistinguishable from
    // "this order is finished".
    open('PendingApproval');

    expect(screen.getByText('order_status_confirmed')).toBeInTheDocument();
    expect(screen.getByText('order_status_cancelled')).toBeInTheDocument();
    expect(screen.queryByText('cashier.no_status_transitions')).not.toBeInTheDocument();
  });

  it('offers a way out of OutForDelivery, the name the server actually emits', () => {
    open('OutForDelivery');

    expect(screen.getByText('order_status_completed')).toBeInTheDocument();
  });

  it('labels every option with a real translation key, never a raw enum or a key path', () => {
    // Both label sites used `t('order.status.' + status)`, and NO `order.status.*` key exists in any
    // locale — i18next returns the key on a miss, and the key is truthy, so the `|| status` fallback
    // beside it was dead. A cashier saw "order.status.Confirmed" on the button.
    open('Ready');

    for (const node of screen.getAllByText(/order[._]status/)) {
      expect(node.textContent).toMatch(/^order_status_/);
      expect(node.textContent).not.toMatch(/^order\.status\./);
    }
  });

  it('says so when an order really is finished, instead of showing an empty list', () => {
    open('Completed');

    expect(screen.getByText('cashier.no_status_transitions')).toBeInTheDocument();
  });

  it('offers nothing for a status this build does not know, rather than guessing a path', () => {
    open('SomeFutureStatus');

    expect(screen.getByText('cashier.no_status_transitions')).toBeInTheDocument();
  });
});
