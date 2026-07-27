import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderTypeConflictModal from './OrderTypeConflictModal';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | object, opts?: Record<string, unknown>) => {
      const template = typeof fallback === 'string' ? fallback : key;
      const vars = (typeof fallback === 'string' ? opts : (fallback as Record<string, unknown>)) ?? {};
      return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

const PENDING = {
  orderType: OrderType.DineIn,
  source: 'sidebar',
  forceModal: false,
  conflicts: [
    {
      basketItemId: 'line-1',
      productName: 'Dürüm',
      quantity: 2,
      allowedOrderTypes: [OrderType.Takeaway, OrderType.Delivery],
    },
    { basketItemId: 'line-2', productName: 'Lahmacun', quantity: 1, allowedOrderTypes: [OrderType.Delivery] },
  ],
};

describe('OrderTypeConflictModal', () => {
  it('renders nothing while no switch is pending', () => {
    render(
      <OrderTypeConflictModal
        pending={null}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText(/removes these items/i)).not.toBeInTheDocument();
  });

  it('NAMES every line it proposes to delete, with its quantity', () => {
    // Asking for consent to delete "× 2" is the failure mode this guards. The names come from the
    // server's own conflict query and were never the field plan §9.11 found empty — that was the
    // echoed `basket`, which this modal does not read.
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('Dürüm × 2')).toBeInTheDocument();
    expect(screen.getByText('Lahmacun × 1')).toBeInTheDocument();
  });

  it('names the channel being switched TO, not the one being left', () => {
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/Switching to Dine In removes these items/)).toBeInTheDocument();
  });

  it('says where each blocked line CAN be ordered, so cancelling is an informed choice', () => {
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Takeaway and Delivery only')).toBeInTheDocument();
    expect(screen.getByText('Delivery only')).toBeInTheDocument();
  });

  it('omits the reason line for a line with no orderable channel left, rather than saying "only"', () => {
    // `allowedOrderTypes` is empty when every channel the item allows is admin-disabled. " only"
    // with nothing before it is worse than silence.
    const pending = {
      orderType: OrderType.DineIn,
      source: 'sidebar',
      forceModal: false,
      conflicts: [{ basketItemId: 'l', productName: 'Ayran', quantity: 1, allowedOrderTypes: [] }],
    };
    render(
      <OrderTypeConflictModal
        pending={pending}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('Ayran × 1')).toBeInTheDocument();
    expect(screen.queryByText(/only/)).not.toBeInTheDocument();
  });

  it('wires confirm and cancel to distinct handlers', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error={null}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove and continue' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('every exit is inert while the removal is in flight, including the header X', () => {
    // BaseModal has FOUR exits and `disableEscapeClose`/`disableBackdropClose` cover only two —
    // the X is an unconditional onClick. `confirm()` has already captured `pending`, so a dismiss
    // that gets through clears the dialog while the removal completes and commits the type anyway.
    const onCancel = jest.fn();
    render(
      <OrderTypeConflictModal pending={PENDING} isApplying error={null} onConfirm={jest.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    const closeButton = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.toLowerCase().includes('close'));
    if (closeButton) fireEvent.click(closeButton);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('lets every exit through once the removal is no longer in flight', () => {
    const onCancel = jest.fn();
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('replaces the reassurance line with the failure, and announces it', () => {
    // A dialog that just vanishes after a failed removal leaves the guest believing they removed
    // items they still have.
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error="order_type_conflict_error"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('could not be removed');
    expect(screen.queryByText('Cancel to keep your order as it is.')).not.toBeInTheDocument();
  });

  it('exposes the doomed lines as a list, so the count is announced before consent', () => {
    render(
      <OrderTypeConflictModal
        pending={PENDING}
        isApplying={false}
        error={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('disables both buttons while the removal is in flight', () => {
    render(
      <OrderTypeConflictModal pending={PENDING} isApplying error={null} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );

    // Destructive and not idempotent from the guest's side — a double tap must not fire twice.
    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
