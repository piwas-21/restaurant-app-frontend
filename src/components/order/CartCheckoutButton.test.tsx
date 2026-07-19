import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CartCheckoutButton from './CartCheckoutButton';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('CartCheckoutButton', () => {
  it('renders the labelled CTA and fires onClick', () => {
    const onClick = jest.fn();
    render(<CartCheckoutButton disabled={false} onClick={onClick} className="cta" />);
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled', () => {
    render(<CartCheckoutButton disabled onClick={jest.fn()} className="cta" />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
  });
});
