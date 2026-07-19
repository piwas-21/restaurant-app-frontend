import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { OrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
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

function renderWith(followUp: OrderTypeFollowUp) {
  const fu = {
    followUp,
    pickType: jest.fn(),
    closeFollowUp: jest.fn(),
    editOrderType: jest.fn(),
    editContact: jest.fn(),
  };
  render(<OrderFlowModals followUp={fu} />);
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
