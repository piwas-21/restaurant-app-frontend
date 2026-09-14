import { PaymentMethod } from '@/types/order';
import { getPaymentMethodLabel } from './paymentMethodDisplay';

const french = (key: string, fallback: string): string =>
  key === 'payment_card_at_restaurant' ? 'Carte au restaurant' : fallback;

describe('getPaymentMethodLabel', () => {
  it('uses the payment option labelKey and translator for the card-at-restaurant intent', () => {
    expect(getPaymentMethodLabel(PaymentMethod.CreditCard, french)).toBe('Carte au restaurant');
    expect(getPaymentMethodLabel(2, french)).toBe('Carte au restaurant');
  });

  it('does not expose the backend CreditCard enum when no translator is provided', () => {
    expect(getPaymentMethodLabel('CreditCard')).toBe('Card at restaurant');
    expect(getPaymentMethodLabel(' creditcard ')).toBe('Card at restaurant');
  });
});
