import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import type { PendingOrderTypeSwitch } from '@/hooks/order/useOrderTypeSwitch';
import { OrderType } from '@/types/order';
import OrderFlowModals from './OrderFlowModals';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({
    state: { orderType: 'DineIn', table: '', deliveryAddress: null },
    setTable: jest.fn(),
    setAddress: jest.fn(),
  }),
}));

// Stub each modal so we can read which one opened (and with what title/required set).
jest.mock('./TableSelectionModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => <div data-testid="table" data-open={String(isOpen)} />,
}));
jest.mock('./DeliveryAddressModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => <div data-testid="address" data-open={String(isOpen)} />,
}));
jest.mock('./TakeawayInfoModal', () => ({
  __esModule: true,
  default: ({ isOpen, title, requiredFields }: { isOpen: boolean; title?: string; requiredFields?: string[] }) => (
    <div
      data-testid="contact"
      data-open={String(isOpen)}
      data-title={title ?? ''}
      data-required={(requiredFields ?? []).join(',')}
    />
  ),
}));
jest.mock('./EditOrderTypeModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => <div data-testid="ordertype" data-open={String(isOpen)} />,
}));
jest.mock('./OrderTypeConflictModal', () => ({
  __esModule: true,
  default: ({ pending, onConfirm, onCancel }: { pending: unknown; onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="conflict" data-open={String(pending !== null)}>
      <button type="button" data-testid="conflict-confirm" onClick={onConfirm} />
      <button type="button" data-testid="conflict-cancel" onClick={onCancel} />
    </div>
  ),
}));

function renderWith(followUp: OrderTypeFollowUp, pending: PendingOrderTypeSwitch | null = null) {
  const fu = {
    followUp,
    pickType: jest.fn(),
    closeFollowUp: jest.fn(),
    editOrderType: jest.fn(),
    editContact: jest.fn(),
    confirmSwitch: jest.fn(),
    switchFlow: {
      pending,
      isApplying: false,
      error: null,
      request: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    },
  };
  render(<OrderFlowModals followUp={fu} />);
  return fu;
}

describe('OrderFlowModals — Edit editors', () => {
  it("opens the order-type editor for the 'ordertype' state (not the contact modal)", () => {
    renderWith('ordertype');
    expect(screen.getByTestId('ordertype')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('contact')).toHaveAttribute('data-open', 'false');
  });

  it("opens the contact editor with the edit title for the 'contact' state", () => {
    renderWith('contact');
    expect(screen.getByTestId('contact')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('contact')).toHaveAttribute('data-title', 'Edit your details');
    expect(screen.getByTestId('ordertype')).toHaveAttribute('data-open', 'false');
  });

  it('requires only name+email when editing a Dine-In order (no forced phone)', () => {
    renderWith('contact');
    expect(screen.getByTestId('contact')).toHaveAttribute('data-required', 'name,email');
  });

  it("opens the takeaway modal without the edit title for the 'takeaway' state", () => {
    renderWith('takeaway');
    expect(screen.getByTestId('contact')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('contact')).toHaveAttribute('data-title', '');
  });
});

describe('OrderFlowModals — order-type conflict confirm', () => {
  it('stays closed while no switch is pending, whatever the follow-up state is', () => {
    renderWith('table');
    expect(screen.getByTestId('conflict')).toHaveAttribute('data-open', 'false');
  });

  it('opens on a pending switch even though no follow-up is open — it runs BEFORE the commit', () => {
    renderWith(null, {
      orderType: OrderType.DineIn,
      source: 'sidebar',
      forceModal: false,
      conflicts: [{ basketItemId: 'i1', productName: 'Dürüm', quantity: 1, allowedOrderTypes: [OrderType.Takeaway] }],
    });
    expect(screen.getByTestId('conflict')).toHaveAttribute('data-open', 'true');
    // Nothing else opened: the type is not committed yet, so no detail modal may pre-empt the confirm.
    expect(screen.getByTestId('table')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('ordertype')).toHaveAttribute('data-open', 'false');
  });

  it('suppresses the review-page type editor behind a confirm — two BaseModals share one Escape', () => {
    const fu = renderWith('ordertype', {
      orderType: OrderType.DineIn,
      source: 'checkout_review',
      forceModal: false,
      conflicts: [{ basketItemId: 'i1', productName: 'Dürüm', quantity: 1, allowedOrderTypes: [OrderType.Takeaway] }],
    });

    expect(screen.getByTestId('conflict')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('ordertype')).toHaveAttribute('data-open', 'false');
    expect(fu).toBeDefined();
  });

  it('routes confirm and cancel to the right handlers — they are not interchangeable', () => {
    const fu = renderWith(null, {
      orderType: OrderType.DineIn,
      source: 'sidebar',
      forceModal: false,
      conflicts: [{ basketItemId: 'i1', productName: 'Dürüm', quantity: 1, allowedOrderTypes: [OrderType.Takeaway] }],
    });

    fireEvent.click(screen.getByTestId('conflict-confirm'));
    expect(fu.confirmSwitch).toHaveBeenCalledTimes(1);
    expect(fu.switchFlow.cancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('conflict-cancel'));
    expect(fu.switchFlow.cancel).toHaveBeenCalledTimes(1);
  });
});
