import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CartLineControls from './CartLineControls';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const styles = { itemControls: 'ic', iconButton: 'ib', qtyGroup: 'qg', qtyButton: 'qb', qty: 'q' } as const;

type Overrides = Partial<{ quantity: number; disabled: boolean }>;

const setup = (over: Overrides = {}) => {
  const props = {
    quantity: 2,
    disabled: false,
    onRemove: jest.fn(),
    onDecrement: jest.fn(),
    onIncrement: jest.fn(),
    styles,
    ...over,
  };
  render(<CartLineControls {...props} />);
  return props;
};

describe('CartLineControls', () => {
  it('renders remove + stepper with the current quantity', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('fires the handlers on click', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(p.onRemove).toHaveBeenCalledTimes(1);
    expect(p.onDecrement).toHaveBeenCalledTimes(1);
    expect(p.onIncrement).toHaveBeenCalledTimes(1);
  });

  it('disables decrement at quantity 1 but keeps increment enabled', () => {
    setup({ quantity: 1 });
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
  });

  it('disables every control while syncing', () => {
    setup({ disabled: true });
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });
});
