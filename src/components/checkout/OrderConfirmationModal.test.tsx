import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { PaymentMethod } from '@/types/order';
import OrderConfirmationModal from './OrderConfirmationModal';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) =>
      key === 'payment_card_at_restaurant_reminder'
        ? 'Veuillez payer par carte au restaurant. Pas encore payé.'
        : fallback,
  }),
}));

describe('OrderConfirmationModal payment reminder', () => {
  const props = {
    isOpen: true,
    orderNumber: 'ORD-1',
    customerEmail: '',
    isLoggedIn: false,
    onClose: jest.fn(),
  };

  it('shows the translated card-at-restaurant reminder without claiming payment', () => {
    render(<OrderConfirmationModal {...props} paymentMethod={PaymentMethod.CreditCard} />);

    expect(screen.getByRole('note')).toHaveTextContent('Veuillez payer par carte au restaurant. Pas encore payé.');
    expect(screen.getByRole('note')).toHaveTextContent(/pas encore payé/i);
  });

  it('does not show the card reminder for cash orders', () => {
    render(<OrderConfirmationModal {...props} paymentMethod={PaymentMethod.Cash} />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
